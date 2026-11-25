import { Router } from 'express';
import {
  listarProductos,
  buscarProductoPorId,
  listarImagenesProducto,
} from '../repositories/productos.repository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ErrorNoEncontrado } from '../utils/errors.js';
import { limiteDesdeQuery, decodificarCursor, codificarCursor } from '../utils/pagination.js';
import { calcularPrecioPedido } from '../services/precioPedido.service.js';

export const productosRouter = Router();

function serializarProducto(row, imagenes = row.imagenes || []) {
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
    resumen: row.descripcion?.split(/\n\s*\n/, 1)[0] || null,
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

    const rows = await listarProductos({
  categoria,
  tipoVenta,
  precioMin,
  precioMax,
  q,
  cursor,
  limite,
	});

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
    const producto = await buscarProductoPorId(req.params.id);
    if (!producto) {
      throw ErrorNoEncontrado('Producto no encontrado');
    }

    const imgs = await listarImagenesProducto(req.params.id);
    const detalle = serializarProducto(producto, imgs.map((i) => i.url_blob));
    if (detalle.tipoVenta === 'fijo' && detalle.precioUsd !== null) {
      detalle.estimacionCompra = calcularPrecioPedido(detalle.precioUsd);
    }
    res.json(detalle);
  })
);
