import { verificarToken } from '../utils/jwt.js';
import { ErrorAutenticacion, ErrorAutorizacion } from '../utils/errors.js';
import { query } from '../config/db.js';

/** Exige un bearerAuth válido (openapi.yaml: security: [bearerAuth]) y adjunta req.usuario. */
export async function requiereAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [esquema, token] = header.split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw ErrorAutenticacion();
    }
    const payload = verificarToken(token);
    if (payload.tipo === 'refresh') throw ErrorAutenticacion('Se requiere un access token, no uno de renovación');

    const { rows } = await query('SELECT id, email, nombre, apellido, estado FROM usuarios WHERE id = $1', [payload.sub]);
    if (rows.length === 0) throw ErrorAutenticacion('El usuario del token ya no existe');
    if (rows[0].estado === 'suspendido') throw ErrorAutenticacion('Cuenta suspendida');

    req.usuario = rows[0];
    next();
  } catch (err) {
    if (err.status) return next(err);
    return next(ErrorAutenticacion());
  }
}

/** Exige que el usuario autenticado tenga el rol dado (M5 · Administración). */
export function requiereRol(nombreRol) {
  return async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT r.nombre FROM roles r
         JOIN usuario_rol ur ON ur.id_rol = r.id
         WHERE ur.id_usuario = $1`,
        [req.usuario.id]
      );
      const tieneRol = rows.some((r) => r.nombre === nombreRol);
      if (!tieneRol) throw ErrorAutorizacion(`Requiere el rol "${nombreRol}"`);
      next();
    } catch (err) {
      next(err.status ? err : ErrorAutorizacion());
    }
  };
}
