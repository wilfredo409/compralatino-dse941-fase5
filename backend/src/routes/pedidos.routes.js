import { Router } from 'express';
import { withTransaction } from '../config/db.js';
import {
  listarDetallePedido,
  buscarDireccionPedido,
  bloquearProductos,
  buscarProductoParaPedido,
  siguienteNumeroPedido,
  insertarPedido,
  insertarDetallePedido,
  descontarExistencias,
  listarPedidosDeUsuario,
  buscarPedidoDeUsuario,
  insertarPagoAutorizado,
  marcarPedidoPagado,
  registrarAuditoriaPago,
  buscarProductoParaPuja,
  verificarProductoEnPedido,
  insertarPuja,
} from '../repositories/pedidos.repository.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requiereAuth } from '../middleware/auth.js';
import { ErrorValidacion, ErrorNoEncontrado, ErrorConflicto, ErrorDependenciaExterna } from '../utils/errors.js';
import { limiteDesdeQuery, decodificarCursor, codificarCursor } from '../utils/pagination.js';
import { yAuctionsAdapter } from '../adapters/YAuctionsAdapter.js';

export const pedidosRouter = Router();
pedidosRouter.use(requiereAuth);

// Supuestos documentados en supuestos_fase3.md #9 (comisión/flete de la
// primera versión funcional, hasta que el equipo defina una tabla de tarifas):
const FLETE_FIJO_USD = 12.0;
const COMISION_PORCENTAJE = 0.05; // 5% de intermediación sobre el subtotal

async function serializarPedido(pedidoRow) {
  const { rows: detalle } = await listarDetallePedido(pedidoRow.id);
  return {
    id: pedidoRow.id,
    codigo: pedidoRow.codigo,
    estado: pedidoRow.estado,
    subtotalUsd: Number(pedidoRow.subtotal_usd),
    fleteUsd: Number(pedidoRow.flete_usd),
    comisionUsd: Number(pedidoRow.comision_usd),
    totalUsd: Number(pedidoRow.total_usd),
    fechaCreacion: pedidoRow.fecha_creacion,
    detalle: detalle.map((d) => ({
      idProducto: d.id_producto,
      cantidad: d.cantidad,
      precioUnitarioUsd: Number(d.precio_unitario_usd),
    })),
  };
}

// POST /pedidos
pedidosRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { idDireccion, items } = req.body || {};
    if (!idDireccion || !Array.isArray(items) || items.length === 0) {
      throw ErrorValidacion('idDireccion e items (al menos un ítem) son obligatorios');
    }

    const pedido = await withTransaction(async (client) => {
      const { rows: dirRows } = await buscarDireccionPedido(client, idDireccion, req.usuario.id);
      if (dirRows.length === 0) throw ErrorValidacion('La dirección no existe o no pertenece al usuario');

      // Un pedido puede mezclar ítems de compra directa (tipo 'fijo', que sí
      // afectan subtotal/stock de una vez) con ítems de subasta (tipo
      // 'subasta', que solo "reservan" el producto en el pedido: su precio
      // real se define después, cuando se envían las ofertas una a una vía
      // POST /pedidos/{id}/ofertas). Ver supuestos_fase3.md #11.
      for (const item of items) {
        if (!item.idProducto || !item.cantidad || item.cantidad < 1) {
          throw ErrorValidacion('Cada ítem requiere idProducto y cantidad >= 1');
        }
      }

      // Bloquea las filas de los productos del pedido, en orden de id, hasta el
      // COMMIT. Así dos compras simultáneas del mismo producto se serializan
      // (la segunda ve el stock ya descontado) y, al tomar los bloqueos siempre
      // en el mismo orden, dos pedidos con varios productos no se interbloquean.
      const idsProductos = [...new Set(items.map((item) => item.idProducto))];
      await bloquearProductos(client, idsProductos);

      let subtotal = 0;
      const detallePreparado = [];
      for (const item of items) {
        const { rows: prodRows } = await buscarProductoParaPedido(client, item.idProducto);
        if (prodRows.length === 0) throw ErrorNoEncontrado(`Producto ${item.idProducto} no encontrado`);
        const producto = prodRows[0];

        if (producto.tipo_venta === 'fijo') {
          if (producto.stock < item.cantidad) {
            throw ErrorConflicto(`Stock insuficiente para "${producto.titulo}"`, { disponible: producto.stock });
          }
          const precioUnitario = Number(producto.precio_usd);
          subtotal += precioUnitario * item.cantidad;
          detallePreparado.push({ idProducto: producto.id, cantidad: item.cantidad, precioUnitario, afectaStock: true });
        } else {
          // Subasta: no se cobra ni se descuenta stock todavía; el precio
          // mostrado es solo de referencia hasta que se resuelva la oferta.
          detallePreparado.push({
            idProducto: producto.id,
            cantidad: item.cantidad,
            precioUnitario: Number(producto.precio_usd ?? 0),
            afectaStock: false,
          });
        }
      }

      const flete = FLETE_FIJO_USD;
      const comision = Math.round(subtotal * COMISION_PORCENTAJE * 100) / 100;
      const total = Math.round((subtotal + flete + comision) * 100) / 100;

      const { rows: seqRows } = await siguienteNumeroPedido(client);
      const codigo = `CL-${new Date().getFullYear()}-${String(seqRows[0].n).padStart(4, '0')}`;

      const { rows: pedidoRows } = await insertarPedido(client, [codigo, req.usuario.id, idDireccion, subtotal.toFixed(2), flete.toFixed(2), comision.toFixed(2), total.toFixed(2)]);
      const pedidoCreado = pedidoRows[0];

      for (const item of detallePreparado) {
        await insertarDetallePedido(client, pedidoCreado.id, item);
        if (item.afectaStock) {
          // Descuento condicional: nunca deja el stock en negativo, aunque
          // otro proceso lo haya cambiado entre la lectura y esta sentencia.
          const descuento = await descontarExistencias(client, item.cantidad, item.idProducto);
          if (descuento.rowCount === 0) {
            throw ErrorConflicto('Stock insuficiente: otra compra se llevó las últimas unidades', { idProducto: item.idProducto });
          }
        }
      }

      return pedidoCreado;
    });

    res.status(201).json(await serializarPedido(pedido));
  })
);

// GET /pedidos — historial del usuario autenticado
pedidosRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const limite = limiteDesdeQuery(req.query);
    const cursor = decodificarCursor(req.query.cursor);

    const { rows } = await listarPedidosDeUsuario(req.usuario.id, cursor, limite);
    const hayMas = rows.length > limite;
    const pagina = rows.slice(0, limite);
    const ultimo = pagina[pagina.length - 1];

    res.json({
      items: await Promise.all(pagina.map(serializarPedido)),
      cursorSiguiente: hayMas && ultimo ? codificarCursor(ultimo.fecha_creacion, ultimo.id) : null,
      total: null,
    });
  })
);

async function pedidoDelUsuario(idPedido, idUsuario) {
  const { rows } = await buscarPedidoDeUsuario(idPedido, idUsuario);
  if (rows.length === 0) throw ErrorNoEncontrado('Pedido no encontrado');
  return rows[0];
}

// POST /pedidos/{id}/pago
pedidosRouter.post(
  '/:id/pago',
  asyncHandler(async (req, res) => {
    const { proveedor, tokenPago } = req.body || {};
    if (!proveedor || !tokenPago) throw ErrorValidacion('proveedor y tokenPago son obligatorios');

    const pedido = await pedidoDelUsuario(req.params.id, req.usuario.id);
    if (pedido.estado !== 'creado') {
      throw ErrorConflicto(`El pedido está en estado "${pedido.estado}", no admite un nuevo pago`);
    }

    // Nota: la pasarela de pago real está fuera de alcance (ver supuestos_fase3.md
    // #9); aquí se simula una autorización síncrona exitosa y queda pendiente
    // de captura definitiva vía POST /webhooks/pagos (patrón usado por
    // pasarelas reales tipo Stripe/PayPal).
    const pago = await withTransaction(async (client) => {
      const { rows } = await insertarPagoAutorizado(client, pedido, proveedor, tokenPago);
      await marcarPedidoPagado(client, pedido.id);
      await registrarAuditoriaPago(client, req.usuario.id, pedido);
      return rows[0];
    });

    res.status(202).json({
      id: pago.id,
      proveedor: pago.proveedor,
      estado: pago.estado,
      monto: Number(pago.monto),
      fecha: pago.fecha,
    });
  })
);

// POST /pedidos/{id}/ofertas — coloca una puja en YAuctions vía YAuctionsAdapter
pedidosRouter.post(
  '/:id/ofertas',
  asyncHandler(async (req, res) => {
    const { idProducto, montoJpy, simularFallo } = req.body || {};
    if (!idProducto || !montoJpy) throw ErrorValidacion('idProducto y montoJpy son obligatorios');

    const pedido = await pedidoDelUsuario(req.params.id, req.usuario.id);
    const { rows: prodRows } = await buscarProductoParaPuja(idProducto);
    if (prodRows.length === 0) throw ErrorNoEncontrado('Producto no encontrado');
    if (prodRows[0].tipo_venta !== 'subasta') throw ErrorValidacion('El producto no es de tipo subasta');

    const { rows: detalleRows } = await verificarProductoEnPedido(pedido.id, idProducto);
    if (detalleRows.length === 0) {
      throw ErrorValidacion('El producto debe agregarse primero al pedido (POST /pedidos) antes de enviar una oferta');
    }

    let respuestaExterna;
    try {
      // `simularFallo` (opcional, solo para demo/QA) fuerza un error en el
      // adaptador y permite mostrar el Circuit Breaker abriéndose sin
      // depender del azar de YAUCTIONS_FAILURE_RATE.
      respuestaExterna = await yAuctionsAdapter.enviarOferta({ idProducto, montoJpy, simularFallo: !!simularFallo });
    } catch (err) {
      throw ErrorDependenciaExterna(undefined, { motivo: err.message, circuitoAbierto: !!err.circuitoAbierto });
    }

    const { rows } = await insertarPuja(pedido.id, idProducto, montoJpy, respuestaExterna);

    res.status(202).json({
      id: rows[0].id,
      idProducto: rows[0].id_producto,
      montoJpy: Number(rows[0].monto_jpy),
      estado: rows[0].estado,
      fechaEnvio: rows[0].fecha_envio,
    });
  })
);
