import { query } from '../config/db.js';

export function listarDetallePedido(idPedido) {
  return query(
    'SELECT id_producto, cantidad, precio_unitario_usd FROM pedido_detalle WHERE id_pedido = $1',
    [idPedido]
  );
}

export function buscarDireccionPedido(client, idDireccion, idUsuario) {
  return client.query(
    'SELECT id FROM direcciones WHERE id = $1 AND id_usuario = $2',
    [idDireccion, idUsuario]
  );
}

export function bloquearProductos(client, idsProductos) {
  return client.query(
    'SELECT id FROM productos WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [idsProductos]
  );
}

export function buscarProductoParaPedido(client, idProducto) {
  return client.query(
    'SELECT * FROM productos WHERE id = $1',
    [idProducto]
  );
}

export function siguienteNumeroPedido(client) {
  return client.query(
    "SELECT nextval('pedido_codigo_seq') AS n"
  );
}

export function insertarPedido(client, datos) {
  return client.query(
    `INSERT INTO pedidos (codigo, id_usuario, id_direccion, subtotal_usd, flete_usd, comision_usd, total_usd)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    datos
  );
}

export function insertarDetallePedido(client, idPedido, item) {
  return client.query(
    `INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario_usd)
    VALUES ($1, $2, $3, $4)`,
    [idPedido, item.idProducto, item.cantidad, item.precioUnitario.toFixed(2)]
  );
}

export function descontarExistencias(client, cantidad, idProducto) {
  return client.query(
    'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
    [cantidad, idProducto]
  );
}

export function listarPedidosDeUsuario(idUsuario, cursor, limite) {
  const filtroCursor = cursor ? "AND (date_trunc('milliseconds', fecha_creacion), id) < ($3, $4)" : '';
  const params = [idUsuario, limite + 1];
  if (cursor) params.push(cursor.o, cursor.id);
  return query(
    `SELECT * FROM pedidos WHERE id_usuario = $1 ${filtroCursor}
     ORDER BY date_trunc('milliseconds', fecha_creacion) DESC, id DESC LIMIT $2`,
    params
  );
}

export function buscarPedidoDeUsuario(idPedido, idUsuario) {
  return query(
    'SELECT * FROM pedidos WHERE id = $1 AND id_usuario = $2',
    [idPedido, idUsuario]
  );
}

export function insertarPagoAutorizado(client, pedido, proveedor, tokenPago) {
  return client.query(
    `INSERT INTO pagos (id_pedido, proveedor, token_transaccion, monto, estado)
    VALUES ($1, $2, $3, $4, 'autorizado') RETURNING *`,
    [pedido.id, proveedor, tokenPago, pedido.total_usd]
  );
}

export function marcarPedidoPagado(client, idPedido) {
  return client.query(
    "UPDATE pedidos SET estado = 'pagado' WHERE id = $1",
    [idPedido]
  );
}

export function registrarAuditoriaPago(client, idUsuario, pedido) {
  return client.query(
    `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, datos_previos)
    VALUES ($1, 'AUTORIZAR_PAGO', 'pedidos', $2, $3::jsonb)`,
    [idUsuario, pedido.id, JSON.stringify({ estadoAnterior: pedido.estado })]
  );
}

export function buscarProductoParaPuja(idProducto) {
  return query(
    'SELECT * FROM productos WHERE id = $1',
    [idProducto]
  );
}

export function verificarProductoEnPedido(idPedido, idProducto) {
  return query(
    'SELECT 1 FROM pedido_detalle WHERE id_pedido = $1 AND id_producto = $2',
    [idPedido, idProducto]
  );
}

export function insertarPuja(idPedido, idProducto, montoJpy, respuestaExterna) {
  return query(
    `INSERT INTO pujas (id_pedido, id_producto, monto_jpy, estado, respuesta_ya)
    VALUES ($1, $2, $3, 'enviada', $4::jsonb) RETURNING *`,
    [idPedido, idProducto, montoJpy, JSON.stringify(respuestaExterna)]
  );
}
