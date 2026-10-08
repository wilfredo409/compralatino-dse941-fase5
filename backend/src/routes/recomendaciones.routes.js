import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { recalcularRecomendaciones } from '../services/recomendaciones.service.js';

export const recomendacionesRouter = Router();
recomendacionesRouter.use(requiereAuth);

// GET /recomendaciones — recalcula (regla de negocio en supuestos_fase3.md #1)
// y devuelve las recomendaciones vigentes del usuario autenticado.
recomendacionesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filas = await recalcularRecomendaciones(req.usuario.id);
    res.json(
      filas.map((f) => ({
        idProducto: f.id_producto,
        puntaje: Number(f.puntaje),
        motivo: f.motivo,
        fechaGeneracion: f.fecha_generacion,
      }))
    );
  })
);
