import { Router } from 'express';
import { query } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ErrorNoEncontrado } from '../utils/errors.js';
import { limiteDesdeQuery, decodificarCursor, codificarCursor } from '../utils/pagination.js';

export const productosRouter = Router();

function serializarProducto(row, imagenes = []) {
  return {
    id: row.id,
    idExternoYa: row.id_externo_ya,
    idCategoria: row.id_categoria,
    titulo: row.titulo,
    descripcion: row.descripcion,
    precioJpy: Number(row.precio_jpy),
    precioUsd: row.precio_usd === null ? null : Number(row.precio_usd),
    tipoVenta: row.tipo_venta,
    fechaFinSubasta: row.fecha_fin_subasta,
    stock: row.stock,
    imagenes,
  };
}

// GET /productos — búsqueda paginada con filtros (Tabla 23)
productosRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { categoria, tipoVenta, precioMin, precioMax, q } = req.query;
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);

    const condiciones = [];
    const params = [];
    let i = 1;

    if (categoria) { condiciones.push(`id_categoria = $${i++}`); params.push(Number(categoria)); }
    if (tipoVenta) { condiciones.push(`tipo_venta = $${i++}`); params.push(tipoVenta); }
    if (precioMin) { condiciones.push(`precio_usd >= $${i++}`); params.push(Number(precioMin)); }
    if (precioMax) { condiciones.push(`precio_usd <= $${i++}`); params.push(Number(precioMax)); }
    if (q) { condiciones.push(`titulo ILIKE $${i++}`); params.push(`%${q}%`); }
    if (cursor) {
      condiciones.push(`(date_trunc('milliseconds', fecha_sincronizacion), id) < ($${i++}, $${i++})`);
      params.push(cursor.o, cursor.id);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM productos ${where}
       ORDER BY date_trunc('milliseconds', fecha_sincronizacion) DESC, id DESC
       LIMIT $${i}`,
      [...params, limite + 1]
    );

    const hayMas = rows.length > limite;
    const pagina = rows.slice(0, limite);
    const ultimo = pagina[pagina.length - 1];

    res.json({
      items: pagina.map((r) => serializarProducto(r)),
      cursorSiguiente: hayMas && ultimo ? codificarCursor(ultimo.fecha_sincronizacion, ultimo.id) : null,
      total: null, // no se calcula COUNT(*) exacto por costo; PaginaCursor lo admite nullable
    });
  })
);

// GET /productos/{id} — ficha completa con precio convertido
productosRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) throw ErrorNoEncontrado('Producto no encontrado');

    const { rows: imgs } = await query(
      'SELECT url_blob FROM producto_imagenes WHERE id_producto = $1 ORDER BY orden',
      [req.params.id]
    );
    res.json(serializarProducto(rows[0], imgs.map((i) => i.url_blob)));
  })
);
