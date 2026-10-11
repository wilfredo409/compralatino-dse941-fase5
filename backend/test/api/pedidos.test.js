import { SIN_BD, crearUsuarioConSesion, crearCatalogoDePrueba, crearDireccion, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let usuario, otro, catalogo, idDireccion, concurrencia;
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

before(async () => {
  if (SIN_BD) return;
  usuario = await crearUsuarioConSesion(request, app, 'comprador');
  otro = await crearUsuarioConSesion(request, app, 'otro');
  idDireccion = await crearDireccion(pool, usuario.id);
  catalogo = await crearCatalogoDePrueba(pool, 'pedidos', { cantidad: 2, precioUsd: 100, stock: 10 });
});

after(async () => {
  if (!SIN_BD) {
    await limpiar(pool, { idsUsuario: [usuario?.id, otro?.id].filter(Boolean), idCategoria: catalogo?.idCategoria });
    await limpiar(pool, { idCategoria: concurrencia?.idCategoria });
  }
  await pool.end();
});

test('compra directa: calcula subtotal, flete fijo (12) y comisión (5 %) y descuenta el stock', { skip: SIN_BD }, async () => {
  const [p1] = catalogo.productos;
  const res = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p1.id, cantidad: 2 }] });
  assert.equal(res.status, 201);
  assert.equal(res.body.estado, 'creado');
  assert.match(res.body.codigo, /^CL-\d{4}-\d{4}$/);
  assert.equal(res.body.subtotalUsd, 200);
  assert.equal(res.body.fleteUsd, 12);
  assert.equal(res.body.comisionUsd, 10);
  assert.equal(res.body.totalUsd, 222);
  assert.equal(res.body.detalle.length, 1);

  const { rows } = await pool.query('SELECT stock FROM productos WHERE id = $1', [p1.id]);
  assert.equal(rows[0].stock, 8, 'el stock debe bajar de 10 a 8');
});

test('compra directa: sin stock suficiente responde 409 y no cambia el stock', { skip: SIN_BD }, async () => {
  const [p1] = catalogo.productos; // le quedan 8 unidades
  const res = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p1.id, cantidad: 50 }] });
  assert.equal(res.status, 409);
  assert.equal(res.body.codigo, 'ERROR_CONFLICTO');
  const { rows } = await pool.query('SELECT stock FROM productos WHERE id = $1', [p1.id]);
  assert.equal(rows[0].stock, 8);
});

test('compra: valida los datos de entrada y que la dirección sea del usuario', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const sinItems = await request(app).post('/api/v1/pedidos').set(auth(usuario)).send({ idDireccion, items: [] });
  assert.equal(sinItems.status, 400);

  const direccionAjena = await request(app).post('/api/v1/pedidos').set(auth(otro))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });
  assert.equal(direccionAjena.status, 400, 'una dirección de otro usuario no es válida');
});

test('un usuario no puede ver ni pagar el pedido de otro (404)', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const creado = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });
  assert.equal(creado.status, 201);

  const ajeno = await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(otro))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_x' });
  assert.equal(ajeno.status, 404);
});

test('pago: autoriza el pago, el pedido pasa a «pagado» y un segundo pago se rechaza (409)', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const creado = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });

  const pago = await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(usuario))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_prueba_ok' });
  assert.equal(pago.status, 202);
  assert.equal(pago.body.estado, 'autorizado');
  assert.equal(pago.body.monto, creado.body.totalUsd);

  const { rows } = await pool.query('SELECT estado FROM pedidos WHERE id = $1', [creado.body.id]);
  assert.equal(rows[0].estado, 'pagado');

  const repetido = await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(usuario))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_prueba_ok' });
  assert.equal(repetido.status, 409);
});

function firmar(cuerpo) {
  return crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(JSON.stringify(cuerpo)).digest('hex');
}

test('webhook de pagos: sin firma válida se rechaza (401)', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/webhooks/pagos').set('x-signature', 'firma-falsa')
    .send({ idPedido: '00000000-0000-0000-0000-000000000000', estadoPago: 'capturado' });
  assert.equal(res.status, 401);
});

test('webhook de pagos: «rechazado» deja el pedido «cancelado» (coherente con el panel admin)', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const creado = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });
  await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(usuario))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_prueba_rechazo' });

  const cuerpo = { idPedido: creado.body.id, estadoPago: 'rechazado' };
  const res = await request(app).post('/api/v1/webhooks/pagos').set('x-signature', firmar(cuerpo)).send(cuerpo);
  assert.equal(res.status, 200);

  const { rows } = await pool.query(
    'SELECT p.estado AS pedido, pg.estado AS pago FROM pedidos p JOIN pagos pg ON pg.id_pedido = p.id WHERE p.id = $1',
    [creado.body.id]
  );
  assert.equal(rows[0].pago, 'rechazado');
  assert.equal(rows[0].pedido, 'cancelado');
});

test('webhook de pagos: «capturado» mueve el pedido pagado a «en_proceso»', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const creado = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });
  await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(usuario))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_prueba_captura' });

  const cuerpo = { idPedido: creado.body.id, estadoPago: 'capturado' };
  const res = await request(app).post('/api/v1/webhooks/pagos').set('x-signature', firmar(cuerpo)).send(cuerpo);
  assert.equal(res.status, 200);
  const { rows } = await pool.query('SELECT estado FROM pedidos WHERE id = $1', [creado.body.id]);
  assert.equal(rows[0].estado, 'en_proceso');
});

test('compras simultáneas del mismo producto: el stock nunca queda en negativo ni se vende de más', { skip: SIN_BD }, async () => {
  concurrencia = await crearCatalogoDePrueba(pool, 'concurrencia', { cantidad: 1, precioUsd: 10, stock: 2 });
  const [p] = concurrencia.productos;

  // Cinco clientes piden 1 unidad a la vez de un producto que solo tiene 2.
  const respuestas = await Promise.all(
    Array.from({ length: 5 }, () => request(app).post('/api/v1/pedidos').set(auth(usuario))
      .send({ idDireccion, items: [{ idProducto: p.id, cantidad: 1 }] }))
  );
  const estados = respuestas.map((r) => r.status).sort();
  assert.deepEqual(estados, [201, 201, 409, 409, 409], 'solo se atienden tantas compras como unidades había');

  const { rows } = await pool.query('SELECT stock FROM productos WHERE id = $1', [p.id]);
  assert.equal(rows[0].stock, 0);
  const vendidas = await pool.query('SELECT COALESCE(SUM(cantidad), 0)::int AS n FROM pedido_detalle WHERE id_producto = $1', [p.id]);
  assert.equal(vendidas.rows[0].n, 2, 'los pedidos rechazados no dejan líneas de detalle (rollback completo)');
});

test('la base de datos rechaza un stock negativo aunque falle la lógica de la aplicación', { skip: SIN_BD }, async () => {
  const [p] = catalogo.productos;
  await assert.rejects(pool.query('UPDATE productos SET stock = -1 WHERE id = $1', [p.id]), { code: '23514' });
});

test('compra: un identificador de producto mal formado responde 400, no 500', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: 'no-es-un-uuid', cantidad: 1 }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.codigo, 'ERROR_VALIDACION');
});

test('compra: un producto inexistente responde 404 y no crea el pedido', { skip: SIN_BD }, async () => {
  const antes = await pool.query('SELECT COUNT(*)::int AS n FROM pedidos WHERE id_usuario = $1', [usuario.id]);
  const res = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: '00000000-0000-0000-0000-000000000000', cantidad: 1 }] });
  assert.equal(res.status, 404);
  const despues = await pool.query('SELECT COUNT(*)::int AS n FROM pedidos WHERE id_usuario = $1', [usuario.id]);
  assert.equal(despues.rows[0].n, antes.rows[0].n);
});

test('webhook de pagos: un estado de pago desconocido responde 400, no 500', { skip: SIN_BD }, async () => {
  const [, p2] = catalogo.productos;
  const creado = await request(app).post('/api/v1/pedidos').set(auth(usuario))
    .send({ idDireccion, items: [{ idProducto: p2.id, cantidad: 1 }] });
  await request(app).post(`/api/v1/pedidos/${creado.body.id}/pago`).set(auth(usuario))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_estado_raro' });

  const cuerpo = { idPedido: creado.body.id, estadoPago: 'inventado' };
  const res = await request(app).post('/api/v1/webhooks/pagos').set('x-signature', firmar(cuerpo)).send(cuerpo);
  assert.equal(res.status, 400);
  assert.equal(res.body.codigo, 'ERROR_VALIDACION');
});
