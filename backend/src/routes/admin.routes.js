import { Router } from 'express';
import {
  sumarVentasOperativas,
  promediarPedidos,
  contarOfertas,
  contarUsuarios,
  listarPedidosConIncidencia,
  listarPedidosAdministrados,
  listarPagosParaReporte,
  listarUsuariosAdministrados,
  actualizarEstadoUsuario,
  listarAuditoria,
} from '../repositories/administracion.repository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiereAuth, requiereRol } from '../middleware/auth.js';
import { ErrorValidacion, ErrorNoEncontrado } from '../utils/errors.js';
import { limiteDesdeQuery, decodificarCursor, codificarCursor } from '../utils/pagination.js';
import { yAuctionsAdapter } from '../adapters/YAuctionsAdapter.js';
import { obtenerTasaVigente } from '../services/tipoCambio.service.js';
import { obtenerPeriodosEjecutivos } from '../repositories/indicadores.repository.js';

export const adminRouter = Router();
adminRouter.use(requiereAuth, requiereRol('administrador'));

// Alcance del panel administrativo (supuestos_fase3.md #2): ventana fija de
// 30 días, réplica de las tarjetas/tablas del wireframe W06.
const VENTANA_DIAS = 30;

adminRouter.get('/cuadro-mando', asyncHandler(async (req, res) => {
  const dias = String(req.query.dias ?? VENTANA_DIAS);
  if (!['7', '30', '90'].includes(dias)) throw ErrorValidacion('dias debe ser 7, 30 o 90');

  const periodos = await obtenerPeriodosEjecutivos(Number(dias));
  const porcentaje = (numerador, denominador) =>
    denominador ? Number((100 * numerador / denominador).toFixed(1)) : null;
  const resumir = ({ usd, pedidos, clientes, recurrentes, entregados }) => ({
    ventasUsd: Number(usd),
    pedidos,
    compradores: clientes,
    compradoresRecurrentesPorcentaje: porcentaje(recurrentes, clientes),
    pedidosEntregadosPorcentaje: porcentaje(entregados, pedidos),
  });

  res.json({ dias: Number(dias), actual: resumir(periodos.actual), anterior: resumir(periodos.anterior) });
}));

// GET /admin/metricas
adminRouter.get(
  '/metricas',
  asyncHandler(async (req, res) => {
    const [ventas, ticket, ofertas, usuarios, tasa, pedidosAtencion] = await Promise.all([
      sumarVentasOperativas(VENTANA_DIAS),
      promediarPedidos(VENTANA_DIAS),
      contarOfertas(VENTANA_DIAS),
      contarUsuarios(VENTANA_DIAS),
      obtenerTasaVigente('JPY', 'USD'),
      listarPedidosConIncidencia(),
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

    const { rows } = await listarPedidosAdministrados(estado, cursor, limite);
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
    const { rows } = await listarPagosParaReporte(desde, hasta);

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
    const { rows } = await listarUsuariosAdministrados(cursor, limite);
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

    const u = await actualizarEstadoUsuario(req.usuario.id, id, estado);
    if (!u) throw ErrorNoEncontrado('Usuario no encontrado');
    res.json({ id: u.id, email: u.email, nombre: u.nombre, apellido: u.apellido, telefono: u.telefono, estado: u.estado, fechaRegistro: u.fecha_registro });
  })
);

// GET /admin/auditoria
adminRouter.get(
  '/auditoria',
  asyncHandler(async (req, res) => {
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);
    const { rows } = await listarAuditoria(cursor, limite);
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
