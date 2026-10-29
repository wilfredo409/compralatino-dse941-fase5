import { query } from '../config/db.js';

export async function listarProductos({
  categoria, tipoVenta, precioMin, precioMax, q, cursor, limite,
}) {
  const condiciones = [];
  const params = [];
  let i = 1;

  if (categoria) {
    condiciones.push(`id_categoria = $${i++}`);
    params.push(Number(categoria));
  }
  if (tipoVenta) {
    condiciones.push(`tipo_venta = $${i++}`);
    params.push(tipoVenta);
  }
  if (precioMin) {
    condiciones.push(`precio_usd >= $${i++}`);
    params.push(Number(precioMin));
  }
  if (precioMax) {
    condiciones.push(`precio_usd <= $${i++}`);
    params.push(Number(precioMax));
  }
  if (q) {
    condiciones.push(`titulo ILIKE $${i++}`);
    params.push(`%${q}%`);
  }
  if (cursor) {
    condiciones.push(
      `(date_trunc('milliseconds', fecha_sincronizacion), id) < ($${i++}, $${i++})`
    );
    params.push(cursor.o, cursor.id);
  }

  const where = condiciones.length
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const { rows } = await query(
    `SELECT * FROM productos ${where}
     ORDER BY date_trunc('milliseconds', fecha_sincronizacion) DESC, id DESC
     LIMIT $${i}`,
    [...params, limite + 1]
  );
  return rows;
}

export async function buscarProductoPorId(id) {
  const { rows } = await query(
    'SELECT * FROM productos WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function listarImagenesProducto(id) {
  const { rows } = await query(
    'SELECT url_blob FROM producto_imagenes WHERE id_producto = $1 ORDER BY orden',
    [id]
  );
  return rows;
}