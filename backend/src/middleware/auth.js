import { verificarToken } from '../utils/jwt.js';
import { ErrorAutenticacion, ErrorAutorizacion } from '../utils/errors.js';
import { buscarUsuarioPorId, usuarioTieneRol } from '../repositories/usuarios.repository.js';

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

    const usuario = await buscarUsuarioPorId(payload.sub);
    if (!usuario) throw ErrorAutenticacion('El usuario del token ya no existe');
    if (usuario.estado === 'suspendido') throw ErrorAutenticacion('Cuenta suspendida');

    req.usuario = usuario;
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
      const tieneRol = await usuarioTieneRol(req.usuario.id, nombreRol);
      if (!tieneRol) throw ErrorAutorizacion(`Requiere el rol "${nombreRol}"`);
      next();
    } catch (err) {
      next(err.status ? err : ErrorAutorizacion());
    }
  };
}
