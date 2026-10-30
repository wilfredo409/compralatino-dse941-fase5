import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
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
    const { rows: existentes } = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existentes.length > 0) throw ErrorConflicto('Ya existe una cuenta con ese correo');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nombre, apellido, telefono, estado, fecha_registro`,
      [email, hash, nombre, apellido, telefono || null]
    );

    const clienteRol = await query("SELECT id FROM roles WHERE nombre = 'cliente'");
    if (clienteRol.rows[0]) {
      await query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [rows[0].id, clienteRol.rows[0].id]);
    }

    // TODO (fuera de alcance de esta primera versión funcional): disparar el
    // correo real de verificación. Por ahora la cuenta queda en
    // 'pendiente_verificacion' tal como define el CHECK de schema.sql.
    res.status(201).json(serializarUsuario(rows[0]));
  })
);

// POST /auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw ErrorValidacion('email y password son obligatorios');

    const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (rows.length === 0) throw ErrorAutenticacion('Correo o contraseña incorrectos');

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) throw ErrorAutenticacion('Correo o contraseña incorrectos');

    res.json(emitirTokenPar(rows[0]));
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
      const { rows } = await query('SELECT id, email FROM usuarios WHERE id = $1', [payload.sub]);
      if (rows.length === 0) throw new Error('usuario inexistente');
      res.json(emitirTokenPar(rows[0]));
    } catch {
      throw ErrorAutenticacion('Refresh token inválido o expirado');
    }
  })
);
