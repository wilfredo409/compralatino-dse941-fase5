import { query, withTransaction } from '../config/db.js';

export function sumarVentasOperativas(dias) {
  return query(
    `SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total_usd), 0) AS ventas
    FROM pedidos WHERE fecha_creacion >= (now() - $1::int * interval '1 day')
    AND estado IN ('pagado','en_proceso','enviado','entregado')`,
    [dias]
  );
}

export function promediarPedidos(dias) {
  return query(
    `SELECT COALESCE(AVG(total_usd), 0) AS promedio FROM pedidos WHERE fecha_creacion >= (now() - $1::int * interval '1 day')`,
    [dias]
  );
}

export function contarOfertas(dias) {
  return query(
    `SELECT
    COUNT(*) FILTER (WHERE estado = 'aceptada')::int AS aceptadas,
    COUNT(*) FILTER (WHERE estado IN ('aceptada','rechazada','superada'))::int AS resueltas
    FROM pujas WHERE fecha_envio >= (now() - $1::int * interval '1 day')`,
    [dias]
  );
}

export function contarUsuarios(dias) {
  return query(
    `SELECT
    COUNT(*)::int AS registrados,
    COUNT(*) FILTER (WHERE fecha_registro >= (now() - $1::int * interval '1 day'))::int AS nuevos
    FROM usuarios`,
    [dias]
  );
}

export function listarPedidosConIncidencia() {
  return query(
    `SELECT p.codigo, u.nombre || ' ' || u.apellido AS cliente, p.estado, p.total_usd,
    EXTRACT(EPOCH FROM (now() - p.fecha_creacion)) AS antiguedad_seg,
    pg.estado AS estado_pago
    FROM pedidos p
    JOIN usuarios u ON u.id = p.id_usuario
    LEFT JOIN pagos pg ON pg.id_pedido = p.id
    WHERE p.estado = 'cancelado' OR pg.estado = 'rechazado'
    ORDER BY p.fecha_creacion DESC
    LIMIT 10`
  );
}

export function listarPedidosAdministrados(estado, cursor, limite) {
  const params = [limite + 1];
  const condiciones = [];
  if (estado) { condiciones.push("estado = $2"); params.push(estado); }
  if (cursor) {
    const posicion = params.length + 1;
    condiciones.push(`(date_trunc('milliseconds', fecha_creacion), id) < ($${posicion}, $${posicion + 1})`);
    params.push(cursor.o, cursor.id);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return query(
    `SELECT * FROM pedidos ${where} ORDER BY date_trunc('milliseconds', fecha_creacion) DESC, id DESC LIMIT $1`,
    params
  );
}

export function listarPagosParaReporte(desde, hasta) {
  return query(
    `SELECT pg.id, p.codigo AS pedido_codigo, pg.proveedor, pg.monto, pg.estado, pg.fecha
     FROM pagos pg JOIN pedidos p ON p.id = pg.id_pedido
     WHERE ($1::timestamptz IS NULL OR pg.fecha >= $1) AND ($2::timestamptz IS NULL OR pg.fecha <= $2)
     ORDER BY pg.fecha DESC`,
    [desde || null, hasta || null]
  );
}

export function listarUsuariosAdministrados(cursor, limite) {
  const where = cursor ? "WHERE (date_trunc('milliseconds', fecha_registro), id) < ($2, $3)" : '';
  return query(
    `SELECT id, email, nombre, apellido, telefono, estado, fecha_registro FROM usuarios
     ${where} ORDER BY date_trunc('milliseconds', fecha_registro) DESC, id DESC LIMIT $1`,
    cursor ? [limite + 1, cursor.o, cursor.id] : [limite + 1]
  );
}

export function actualizarEstadoUsuario(idAdministrador, id, estado) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE usuarios SET estado = COALESCE($1, estado) WHERE id = $2
       RETURNING id, email, nombre, apellido, telefono, estado, fecha_registro`,
      [estado || null, id]
    );
    if (!rows.length) return null;
    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, datos_previos)
       VALUES ($1, 'ACTUALIZAR_USUARIO', 'usuarios', $2, $3::jsonb)`,
      [idAdministrador, id, JSON.stringify({ nuevoEstado: estado })]
    );
    return rows[0];
  });
}

export function listarAuditoria(cursor, limite) {
  const where = cursor ? "WHERE (date_trunc('milliseconds', fecha), id) < ($2, $3)" : '';
  return query(
    `SELECT id, id_usuario, accion, entidad, id_entidad, fecha FROM auditoria
     ${where} ORDER BY date_trunc('milliseconds', fecha) DESC, id DESC LIMIT $1`,
    cursor ? [limite + 1, cursor.o, cursor.id] : [limite + 1]
  );
}
