// RF-03 · Compras (M3), flujo de subasta: el producto se reserva en el pedido y la oferta se envía a
// YAuctions a través del YAuctionsAdapter (Adapter + Circuit Breaker).
import { SIN_BD, crearUsuarioConSesion, crearCatalogoDePrueba, crearDireccion, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let usuario, otro, idDireccion, subasta, fijo, pedido;
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const ofertar = (idPedido, cuerpo, u = usuario) =>
  request(app).post(`/api/v1/pedidos/${idPedido}/ofertas`).set(auth(u)).send(cuerpo);
const contarPujas = async (idPedido) => Number((await pool.query('SELECT COUNT(*) FROM pujas WHERE id_pedido = $1', [idPedido])).rows[0].count);

before(async () => {
  if (SIN_BD) return;
  usuario = await crearUsuarioConSesion(request, app, 'pujador');
  otro = await crearUsuarioConSesion(request, app, 'ajeno');
  idDireccion = await crearDireccion(pool, usuario.id);
  subasta = await crearCatalogoDePrueba(pool, 'subasta', { cantidad: 1, precioUsd: 300, stock: 0, tipoVenta: 'subasta' });
  fijo = await crearCatalogoDePrueba(pool, 'subasta-fijo', { cantidad: 1, precioUsd: 20, stock: 5 });
});

after(async () => {
  if (!SIN_BD) {
    await limpiar(pool, { idsUsuario: [usuario?.id, otro?.id].filter(Boolean), idCategoria: subasta?.idCategoria });
    await limpiar(pool, { idCategoria: fijo?.idCategoria });
  }
  await pool.end();
});

test('un producto de subasta se reserva en el pedido sin cobrarlo ni tocar el stock', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: subasta.productos[0].id, cantidad: 1 }] });
  assert.equal(res.status, 201);
  assert.equal(res.body.subtotalUsd, 0, 'el precio real se define al resolverse la oferta');
  assert.equal(res.body.fleteUsd, 12);
  assert.equal(res.body.totalUsd, 12);
  assert.equal(res.body.detalle.length, 1);
  pedido = res.body;
});

test('oferta: valida los campos, el tipo de producto y que esté en el pedido', { skip: SIN_BD }, async () => {
  const sinCampos = await ofertar(pedido.id, {});
  assert.equal(sinCampos.status, 400);

  const inexistente = await ofertar(pedido.id, { idProducto: '00000000-0000-0000-0000-000000000000', montoJpy: 40000 });
  assert.equal(inexistente.status, 404);

  const productoFijo = await ofertar(pedido.id, { idProducto: fijo.productos[0].id, montoJpy: 40000 });
  assert.equal(productoFijo.status, 400);
  assert.match(productoFijo.body.mensaje, /no es de tipo subasta/);

  // Otro producto de subasta que NO se agregó al pedido.
  const otraSubasta = await crearCatalogoDePrueba(pool, 'subasta-b', { cantidad: 1, precioUsd: 100, stock: 0, tipoVenta: 'subasta' });
  try {
    const fueraDelPedido = await ofertar(pedido.id, { idProducto: otraSubasta.productos[0].id, montoJpy: 40000 });
    assert.equal(fueraDelPedido.status, 400);
    assert.match(fueraDelPedido.body.mensaje, /agregarse primero al pedido/);
  } finally {
    await limpiar(pool, { idCategoria: otraSubasta.idCategoria });
  }
  assert.equal(await contarPujas(pedido.id), 0, 'ninguna de las ofertas inválidas se registró');
});

test('oferta: no se puede ofertar sobre el pedido de otro usuario (404)', { skip: SIN_BD }, async () => {
  const res = await ofertar(pedido.id, { idProducto: subasta.productos[0].id, montoJpy: 40000 }, otro);
  assert.equal(res.status, 404);
});

test('oferta: con YAuctions caído responde 503 y no registra la puja; la siguiente sí pasa', { skip: SIN_BD }, async () => {
  const fallida = await ofertar(pedido.id, { idProducto: subasta.productos[0].id, montoJpy: 40000, simularFallo: true });
  assert.equal(fallida.status, 503);
  assert.equal(fallida.body.codigo, 'ERROR_DEPENDENCIA_EXTERNA');
  assert.ok(fallida.body.detalle.motivo, 'explica el motivo del fallo');
  assert.equal(await contarPujas(pedido.id), 0, 'una oferta que no llegó a YAuctions no se guarda');

  // Un solo fallo no abre el circuito (umbral de 5): el siguiente intento vuelve a funcionar.
  const ok = await ofertar(pedido.id, { idProducto: subasta.productos[0].id, montoJpy: 40000 });
  assert.equal(ok.status, 202);
});

test('oferta: con YAuctions sano la puja queda registrada con la respuesta externa', { skip: SIN_BD }, async () => {
  const res = await ofertar(pedido.id, { idProducto: subasta.productos[0].id, montoJpy: 42000 });
  assert.equal(res.status, 202);
  assert.equal(res.body.estado, 'enviada');
  assert.equal(res.body.montoJpy, 42000);
  assert.equal(res.body.idProducto, subasta.productos[0].id);

  const { rows } = await pool.query('SELECT monto_jpy, respuesta_ya FROM pujas WHERE id = $1', [res.body.id]);
  assert.equal(Number(rows[0].monto_jpy), 42000);
  assert.equal(rows[0].respuesta_ya.aceptada, true);
  assert.match(rows[0].respuesta_ya.idExternoSubasta, /^YA-/);
});
