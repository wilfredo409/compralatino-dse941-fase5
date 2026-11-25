import { withTransaction } from '../config/db.js';

export function aplicarResultadoPago(idPedido, estadoPago) {
  return withTransaction(async (client) => {
    await client.query('UPDATE pagos SET estado = $1 WHERE id_pedido = $2', [estadoPago, idPedido]);
    if (estadoPago === 'capturado') {
      await client.query("UPDATE pedidos SET estado = 'en_proceso' WHERE id = $1 AND estado = 'pagado'", [idPedido]);
    } else if (estadoPago === 'rechazado') {
      await client.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = $1", [idPedido]);
    }
    await client.query(
      `INSERT INTO auditoria (accion, entidad, id_entidad, datos_previos)
       VALUES ('WEBHOOK_PAGO', 'pedidos', $1, $2::jsonb)`,
      [idPedido, JSON.stringify({ estadoPago })]
    );
  });
}
