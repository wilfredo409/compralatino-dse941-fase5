import { Router } from 'express';
import crypto from 'node:crypto';
import { query, withTransaction } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ErrorAutenticacion, ErrorValidacion } from '../utils/errors.js';
import 'dotenv/config';

export const webhooksRouter = Router();

/**
 * POST /webhooks/pagos — confirmación firmada de la pasarela de pago.
 * Firma esperada en el header X-Signature: HMAC-SHA256(cuerpo_crudo, WEBHOOK_SECRET)
 * (supuesto documentado en supuestos_fase3.md #9, siguiendo el mismo patrón que
 * Stripe/PayPal usan en producción).
 */
webhooksRouter.post(
  '/pagos',
  asyncHandler(async (req, res) => {
    const firmaRecibida = req.headers['x-signature'];
    const secreto = process.env.WEBHOOK_SECRET || '';
    const cuerpoCrudo = JSON.stringify(req.body || {});
    const firmaEsperada = crypto.createHmac('sha256', secreto).update(cuerpoCrudo).digest('hex');

    if (!firmaRecibida || firmaRecibida !== firmaEsperada) {
      throw ErrorAutenticacion('Firma de webhook inválida');
    }

    const { idPedido, estadoPago } = req.body || {};
    if (!idPedido || !estadoPago) throw ErrorValidacion('idPedido y estadoPago son obligatorios');

    await withTransaction(async (client) => {
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

    res.status(200).json({ recibido: true });
  })
);
