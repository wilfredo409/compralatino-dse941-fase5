import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { buscarUsuarioPorId, buscarUsuarioPorEmail, registrarUsuario } from '../repositories/usuarios.repository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ErrorValidacion, ErrorAutenticacion, ErrorConflicto } from '../utils/errors.js';
import { emitirTokenPar, verificarToken } from '../utils/jwt.js';

export const authRouter = Router();

function serializarUsuario(row) {
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    apellido: row.apellido,
    telefono: row.telefono,
    estado: row.estado,
    fechaRegistro: row.fecha_registro,
  };
}

// POST /auth/registro
authRouter.post(
  '/registro',
  asyncHandler(async (req, res) => {
    const { email, password, nombre, apellido, telefono } = req.body || {};
    if (!email || !password || !nombre || !apellido) {
      throw ErrorValidacion('email, password, nombre y apellido son obligatorios');
    }
    if (String(password).length < 8) {
      throw ErrorValidacion('La contraseña debe tener al menos 8 caracteres');
    }

    if (typeof nombre !== 'string') {
       throw ErrorValidacion('El nombre debe ser texto');
    }

    if (nombre.length > 80) {
       throw ErrorValidacion('El nombre no puede superar 80 caracteres');
    }
    const hash = await bcrypt.hash(password, 10);
    const usuario = await registrarUsuario({ email, hash, nombre, apellido, telefono });
    if (!usuario) throw ErrorConflicto('Ya existe una cuenta con ese correo');

    // TODO (fuera de alcance de esta primera versión funcional): disparar el
    // correo real de verificación. Por ahora la cuenta queda en
    // 'pendiente_verificacion' tal como define el CHECK de schema.sql.
    res.status(201).json(serializarUsuario(usuario));
  })
);

// POST /auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw ErrorValidacion('email y password son obligatorios');

    const usuario = await buscarUsuarioPorEmail(email);
    if (!usuario || usuario.estado === 'suspendido') throw ErrorAutenticacion('Correo o contraseña incorrectos');
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) throw ErrorAutenticacion('Correo o contraseña incorrectos');
    res.json(emitirTokenPar(usuario));
  })
);

// POST /auth/refresh
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw ErrorValidacion('refreshToken es obligatorio');
    try {
      const payload = verificarToken(refreshToken);
      if (payload.tipo !== 'refresh') throw new Error('token no es de renovación');
      const usuario = await buscarUsuarioPorId(payload.sub);
      if (!usuario || usuario.estado === 'suspendido') throw new Error('usuario no habilitado');
      res.json(emitirTokenPar(usuario));
    } catch {
      throw ErrorAutenticacion('Refresh token inválido o expirado');
    }
  })
);
