import { Router } from 'express';
import crypto from 'node:crypto';
import { aplicarResultadoPago } from '../repositories/pagos.repository.js';
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
    const secreto = process.env.WEBHOOK_SECRET;
    if (!secreto || !req.cuerpoCrudo || typeof firmaRecibida !== 'string' || !/^[0-9a-f]{64}$/i.test(firmaRecibida)) {
      throw ErrorAutenticacion('Firma de webhook inválida');
    }
    const firmaEsperada = crypto.createHmac('sha256', secreto).update(req.cuerpoCrudo).digest();
    if (!crypto.timingSafeEqual(Buffer.from(firmaRecibida, 'hex'), firmaEsperada)) {
      throw ErrorAutenticacion('Firma de webhook inválida');
    }

    const { idPedido, estadoPago } = req.body || {};
    if (!idPedido || !['autorizado', 'capturado', 'rechazado'].includes(estadoPago)) {
      throw ErrorValidacion('Se requiere idPedido y un estado de pago válido');
    }

    await aplicarResultadoPago(idPedido, estadoPago);

    res.status(200).json({ recibido: true });
  })
);
