import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiereAuth } from '../middleware/auth.js';
import { ErrorValidacion } from '../utils/errors.js';

export const usuariosRouter = Router();
usuariosRouter.use(requiereAuth);

async function cargarPerfilCompleto(idUsuario) {
  const { rows: urows } = await query(
    'SELECT id, email, nombre, apellido, telefono, estado, fecha_registro FROM usuarios WHERE id = $1',
    [idUsuario]
  );
  const usuario = urows[0];
  const { rows: direcciones } = await query(
    'SELECT id, pais, departamento, ciudad, detalle, es_principal FROM direcciones WHERE id_usuario = $1',
    [idUsuario]
  );
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono,
    estado: usuario.estado,
    fechaRegistro: usuario.fecha_registro,
    direcciones: direcciones.map((d) => ({
      id: d.id,
      pais: d.pais,
      departamento: d.departamento,
      ciudad: d.ciudad,
      detalle: d.detalle,
      esPrincipal: d.es_principal,
    })),
  };
}

// GET /usuarios/me
usuariosRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await cargarPerfilCompleto(req.usuario.id));
  })
);

// PUT /usuarios/me
usuariosRouter.put(
  '/me',
  asyncHandler(async (req, res) => {
    const { nombre, apellido, telefono, direcciones } = req.body || {};
    if (!nombre || !apellido) throw ErrorValidacion('nombre y apellido son obligatorios');

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE usuarios SET nombre = $1, apellido = $2, telefono = $3 WHERE id = $4',
        [nombre, apellido, telefono || null, req.usuario.id]
      );
      if (Array.isArray(direcciones)) {
        await client.query('DELETE FROM direcciones WHERE id_usuario = $1', [req.usuario.id]);
        for (const d of direcciones) {
          if (!d.pais || !d.departamento || !d.ciudad || !d.detalle) {
            throw ErrorValidacion('Cada dirección requiere pais, departamento, ciudad y detalle');
          }
          await client.query(
            `INSERT INTO direcciones (id_usuario, pais, departamento, ciudad, detalle, es_principal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.usuario.id, d.pais, d.departamento, d.ciudad, d.detalle, !!d.esPrincipal]
          );
        }
      }
    });

    res.json(await cargarPerfilCompleto(req.usuario.id));
  })
);
