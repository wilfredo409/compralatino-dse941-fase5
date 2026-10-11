import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { ErrorValidacion, ErrorNoEncontrado } from '../utils/errors.js';
import { limiteDesdeQuery, decodificarCursor, codificarCursor } from '../utils/pagination.js';
import { yAuctionsAdapter } from '../adapters/YAuctionsAdapter.js';
import { obtenerTasaVigente } from '../services/tipoCambio.service.js';

export const adminRouter = Router();
adminRouter.use(requiereAuth, requiereRol('administrador'));

// Alcance del panel administrativo (supuestos_fase3.md #2): ventana fija de
// 30 días, réplica de las tarjetas/tablas del wireframe W06.
const VENTANA_DIAS = 30;

// GET /admin/metricas
adminRouter.get(
  '/metricas',
  asyncHandler(async (req, res) => {
    const desde = `now() - interval '${VENTANA_DIAS} days'`;

    const [ventas, ticket, ofertas, usuarios, tasa, pedidosAtencion] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total_usd), 0) AS ventas
         FROM pedidos WHERE fecha_creacion >= ${desde}
           AND estado IN ('pagado','en_proceso','enviado','entregado')`
      ),
      query(`SELECT COALESCE(AVG(total_usd), 0) AS promedio FROM pedidos WHERE fecha_creacion >= ${desde}`),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE estado = 'aceptada')::int AS aceptadas,
           COUNT(*) FILTER (WHERE estado IN ('aceptada','rechazada','superada'))::int AS resueltas
         FROM pujas WHERE fecha_envio >= ${desde}`
      ),
      query(`SELECT
           COUNT(*)::int AS registrados,
           COUNT(*) FILTER (WHERE fecha_registro >= ${desde})::int AS nuevos
         FROM usuarios`),
      obtenerTasaVigente('JPY', 'USD'),
      query(
        `SELECT p.codigo, u.nombre || ' ' || u.apellido AS cliente, p.estado, p.total_usd,
                EXTRACT(EPOCH FROM (now() - p.fecha_creacion)) AS antiguedad_seg,
                pg.estado AS estado_pago
         FROM pedidos p
         JOIN usuarios u ON u.id = p.id_usuario
         LEFT JOIN pagos pg ON pg.id_pedido = p.id
         WHERE p.estado = 'cancelado' OR pg.estado = 'rechazado'
         ORDER BY p.fecha_creacion DESC
         LIMIT 10`
      ),
    ]);

    const totalVentas = Number(ventas.rows[0].ventas);
    const totalPedidos = ventas.rows[0].pedidos;
    const exitoOfertas = ofertas.rows[0].resueltas > 0
      ? Number(((ofertas.rows[0].aceptadas / ofertas.rows[0].resueltas) * 100).toFixed(1))
      : null;

    res.json({
      periodoDias: VENTANA_DIAS,
      ventasUsd: Number(totalVentas.toFixed(2)),
      pedidos: totalPedidos,
      ticketPromedioUsd: Number(Number(ticket.rows[0].promedio).toFixed(2)),
      exitoOfertasPorcentaje: exitoOfertas,
      usuarios: { registrados: usuarios.rows[0].registrados, nuevos: usuarios.rows[0].nuevos },
      tipoCambioVigente: tasa
        ? { par: 'JPY/USD', tasa: Number(tasa.tasa), margen: Number(tasa.margen), vigenciaDesde: tasa.vigencia_desde }
        : null,
      integracionYAuctions: yAuctionsAdapter.salud(),
      pedidosQueRequierenAtencion: pedidosAtencion.rows.map((r) => ({
        codigo: r.codigo,
        cliente: r.cliente,
        motivo: r.estado_pago === 'rechazado' ? 'Pago rechazado' : 'Pedido cancelado',
        antiguedadHoras: Number((r.antiguedad_seg / 3600).toFixed(1)),
        montoUsd: Number(r.total_usd),
      })),
    });
  })
);

// GET /admin/pedidos
adminRouter.get(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const { estado } = req.query;
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);

    const condiciones = [];
    const params = [];
    let i = 1;
    if (estado) { condiciones.push(`estado = $${i++}`); params.push(estado); }
    if (cursor) { condiciones.push(`(date_trunc('milliseconds', fecha_creacion), id) < ($${i++}, $${i++})`); params.push(cursor.o, cursor.id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT * FROM pedidos ${where} ORDER BY date_trunc('milliseconds', fecha_creacion) DESC, id DESC LIMIT $${i}`,
      [...params, limite + 1]
    );
    const hayMas = rows.length > limite;
    const pagina = rows.slice(0, limite);
    const ultimo = pagina[pagina.length - 1];

    res.json({
      items: pagina.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        estado: p.estado,
        subtotalUsd: Number(p.subtotal_usd),
        fleteUsd: Number(p.flete_usd),
        comisionUsd: Number(p.comision_usd),
        totalUsd: Number(p.total_usd),
        fechaCreacion: p.fecha_creacion,
      })),
      cursorSiguiente: hayMas && ultimo ? codificarCursor(ultimo.fecha_creacion, ultimo.id) : null,
      total: null,
    });
  })
);

// GET /admin/reportes/transacciones — CSV
adminRouter.get(
  '/reportes/transacciones',
  asyncHandler(async (req, res) => {
    const { desde, hasta } = req.query;
    const condiciones = [];
    const params = [];
    let i = 1;
    if (desde) { condiciones.push(`pg.fecha >= $${i++}`); params.push(desde); }
    if (hasta) { condiciones.push(`pg.fecha <= $${i++}`); params.push(hasta); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT pg.id, p.codigo AS pedido_codigo, pg.proveedor, pg.monto, pg.estado, pg.fecha
       FROM pagos pg JOIN pedidos p ON p.id = pg.id_pedido
       ${where} ORDER BY pg.fecha DESC`,
      params
    );

    const encabezado = 'id,pedido_codigo,proveedor,monto,estado,fecha';
    const filas = rows.map((r) => [r.id, r.pedido_codigo, r.proveedor, r.monto, r.estado, r.fecha.toISOString()].join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transacciones.csv"');
    res.send([encabezado, ...filas].join('\n'));
  })
);

// GET /admin/usuarios
adminRouter.get(
  '/usuarios',
  asyncHandler(async (req, res) => {
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);
    const condiciones = [];
    const params = [];
    let i = 1;
    if (cursor) { condiciones.push(`(date_trunc('milliseconds', fecha_registro), id) < ($${i++}, $${i++})`); params.push(cursor.o, cursor.id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT id, email, nombre, apellido, telefono, estado, fecha_registro FROM usuarios
       ${where} ORDER BY date_trunc('milliseconds', fecha_registro) DESC, id DESC LIMIT $${i}`,
      [...params, limite + 1]
    );
    const hayMas = rows.length > limite;
    const pagina = rows.slice(0, limite);
    const ultimo = pagina[pagina.length - 1];

    res.json({
      items: pagina.map((u) => ({
        id: u.id, email: u.email, nombre: u.nombre, apellido: u.apellido,
        telefono: u.telefono, estado: u.estado, fechaRegistro: u.fecha_registro,
      })),
      cursorSiguiente: hayMas && ultimo ? codificarCursor(ultimo.fecha_registro, ultimo.id) : null,
      total: null,
    });
  })
);

// PUT /admin/usuarios — actualización de estado/rol
adminRouter.put(
  '/usuarios',
  asyncHandler(async (req, res) => {
    const { id, estado } = req.body || {};
    if (!id) throw ErrorValidacion('id es obligatorio');
    const estadosValidos = ['activo', 'suspendido', 'pendiente_verificacion'];
    if (estado && !estadosValidos.includes(estado)) throw ErrorValidacion(`estado debe ser uno de: ${estadosValidos.join(', ')}`);

    const { rows } = await query(
      'UPDATE usuarios SET estado = COALESCE($1, estado) WHERE id = $2 RETURNING id, email, nombre, apellido, telefono, estado, fecha_registro',
      [estado || null, id]
    );
    if (rows.length === 0) throw ErrorNoEncontrado('Usuario no encontrado');

    await query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, datos_previos)
       VALUES ($1, 'ACTUALIZAR_USUARIO', 'usuarios', $2, $3::jsonb)`,
      [req.usuario.id, id, JSON.stringify({ nuevoEstado: estado })]
    );

    const u = rows[0];
    res.json({ id: u.id, email: u.email, nombre: u.nombre, apellido: u.apellido, telefono: u.telefono, estado: u.estado, fechaRegistro: u.fecha_registro });
  })
);

// GET /admin/auditoria
adminRouter.get(
  '/auditoria',
  asyncHandler(async (req, res) => {
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);
    const condiciones = [];
    const params = [];
    let i = 1;
    if (cursor) { condiciones.push(`(date_trunc('milliseconds', fecha), id) < ($${i++}, $${i++})`); params.push(cursor.o, cursor.id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT id, id_usuario, accion, entidad, id_entidad, fecha FROM auditoria
       ${where} ORDER BY date_trunc('milliseconds', fecha) DESC, id DESC LIMIT $${i}`,
      [...params, limite + 1]
    );
    const hayMas = rows.length > limite;
    const pagina = rows.slice(0, limite);
    const ultimo = pagina[pagina.length - 1];

    res.json({
      items: pagina.map((a) => ({
        id: a.id, idUsuario: a.id_usuario, accion: a.accion, entidad: a.entidad, idEntidad: a.id_entidad, fecha: a.fecha,
      })),
      cursorSiguiente: hayMas && ultimo ? codificarCursor(ultimo.fecha, ultimo.id) : null,
      total: null,
    });
  })
);
