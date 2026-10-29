import { Router } from 'express';
import {
  buscarUsuarioPorId,
  listarDireccionesUsuario,
  actualizarPerfilUsuario,
} from '../repositories/usuarios.repository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiereAuth } from '../middleware/auth.js';
import { ErrorValidacion } from '../utils/errors.js';

export const usuariosRouter = Router();
usuariosRouter.use(requiereAuth);

async function cargarPerfilCompleto(idUsuario) {
  const usuario = await buscarUsuarioPorId(idUsuario);
  const direcciones = await listarDireccionesUsuario(idUsuario);

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

    if (!nombre || !apellido) {
      throw ErrorValidacion('nombre y apellido son obligatorios');
    }

    if (Array.isArray(direcciones)) {
      for (const d of direcciones) {
        if (!d.pais || !d.departamento || !d.ciudad || !d.detalle) {
          throw ErrorValidacion(
            'Cada dirección requiere pais, departamento, ciudad y detalle'
          );
        }
      }
    }

    await actualizarPerfilUsuario(req.usuario.id, {
      nombre,
      apellido,
      telefono,
      direcciones,
    });

    res.json(await cargarPerfilCompleto(req.usuario.id));
  })
);