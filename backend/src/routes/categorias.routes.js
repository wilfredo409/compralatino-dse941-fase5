import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const categoriasRouter = Router();

// GET /categorias — árbol de categorías (id_padre en schema.sql)
categoriasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id, nombre, id_padre FROM categorias ORDER BY id');
    const porId = new Map(rows.map((r) => [r.id, { id: r.id, nombre: r.nombre, idPadre: r.id_padre, subcategorias: [] }]));
    const raices = [];
    for (const r of rows) {
      const nodo = porId.get(r.id);
      if (r.id_padre && porId.has(r.id_padre)) {
        porId.get(r.id_padre).subcategorias.push(nodo);
      } else {
        raices.push(nodo);
      }
    }
    res.json(raices);
  })
);
