import { ApiError } from '../utils/errors.js';

/** Middleware de manejo de errores centralizado (formato uniforme del Anexo B). */
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json(err.toJSON());
  }

  // Errores de PostgreSQL que conviene traducir a algo entendible en vez de un 500 crudo.
  if (err && err.code === '23505') {
    return res.status(409).json({
      codigo: 'ERROR_CONFLICTO',
      mensaje: 'El recurso ya existe (violación de restricción única).',
      detalle: err.detail || null,
    });
  }
  if (err && err.code === '23503') {
    return res.status(400).json({
      codigo: 'ERROR_VALIDACION',
      mensaje: 'Referencia inválida (restricción de llave foránea).',
      detalle: err.detail || null,
    });
  }

  console.error(err);
  return res.status(500).json({
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado en el servidor.',
    detalle: process.env.NODE_ENV === 'production' ? null : String(err.message || err),
  });
}

/** Envuelve un handler async para que sus rechazos lleguen al errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);
