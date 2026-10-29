import { query } from '../config/db.js';

export async function listarCategorias() {
  const { rows } = await query(
    'SELECT id, nombre, id_padre FROM categorias ORDER BY id'
  );
  return rows;
}