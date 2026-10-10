import { SIN_BD, crearUsuarioConSesion, crearCatalogoDePrueba, crearDireccion, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let sinHistorial, navegante, comprador, catalogo, ids;
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const pedirRecomendaciones = (u) => request(app).get('/api/v1/recomendaciones').set(auth(u));

before(async () => {
  if (SIN_BD) return;
  sinHistorial = await crearUsuarioConSesion(request, app, 'sinhistorial');
  navegante = await crearUsuarioConSesion(request, app, 'navegante');
  comprador = await crearUsuarioConSesion(request, app, 'comprador');
  catalogo = await crearCatalogoDePrueba(pool, 'recom', { cantidad: 3, precioUsd: 50, stock: 10 });
  ids = catalogo.productos.map((p) => p.id);
});

after(async () => {
  if (!SIN_BD) await limpiar(pool, { idsUsuario: [sinHistorial?.id, navegante?.id, comprador?.id].filter(Boolean), idCategoria: catalogo?.idCategoria });
  await pool.end();
});

test('requiere autenticación', async () => {
  const res = await request(app).get('/api/v1/recomendaciones');
  assert.equal(res.status, 401);
});

test('nivel 3 · sin compras ni navegación: recomienda la tendencia general del catálogo', { skip: SIN_BD }, async () => {
  const res = await pedirRecomendaciones(sinHistorial);
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0 && res.body.length <= 10);
  assert.ok(res.body.every((r) => r.motivo.startsWith('Tendencia general')));
});

test('nivel 2 · sin compras pero con navegación: recomienda de las categorías visitadas', { skip: SIN_BD }, async () => {
  await pool.query('INSERT INTO historial_navegacion (id_usuario, id_producto) VALUES ($1, $2)', [navegante.id, ids[0]]);
  const res = await pedirRecomendaciones(navegante);
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((r) => r.motivo.includes('visitaste')));
  assert.ok(res.body.every((r) => ids.includes(r.idProducto)), 'todas deben ser de la categoría visitada');
});

test('nivel 1 · con compras: recomienda de la categoría comprada y excluye lo ya comprado', { skip: SIN_BD }, async () => {
  const idDireccion = await crearDireccion(pool, comprador.id);
  const compra = await request(app).post('/api/v1/pedidos').set(auth(comprador))
    .send({ idDireccion, items: [{ idProducto: ids[0], cantidad: 1 }] });
  assert.equal(compra.status, 201);

  const res = await pedirRecomendaciones(comprador);
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((r) => r.motivo.includes('ya compraste')));
  assert.ok(!res.body.some((r) => r.idProducto === ids[0]), 'no debe recomendar lo que ya compró');
  assert.ok(res.body.every((r) => ids.includes(r.idProducto)));
});

test('el puntaje está entre 0.5 y 0.99 y las recomendaciones se persisten con su motivo', { skip: SIN_BD }, async () => {
  const res = await pedirRecomendaciones(comprador);
  assert.ok(res.body.every((r) => r.puntaje >= 0.5 && r.puntaje <= 0.99));
  const { rows } = await pool.query('SELECT count(*)::int AS n, count(motivo)::int AS con_motivo FROM recomendaciones WHERE id_usuario = $1', [comprador.id]);
  assert.equal(rows[0].n, res.body.length);
  assert.equal(rows[0].con_motivo, rows[0].n);
});

test('pedir de nuevo reemplaza las recomendaciones anteriores (no se acumulan)', { skip: SIN_BD }, async () => {
  await pedirRecomendaciones(navegante);
  await pedirRecomendaciones(navegante);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM recomendaciones WHERE id_usuario = $1', [navegante.id]);
  assert.ok(rows[0].n <= 10);
  const unicos = await pool.query('SELECT count(DISTINCT id_producto)::int AS n FROM recomendaciones WHERE id_usuario = $1', [navegante.id]);
  assert.equal(unicos.rows[0].n, rows[0].n);
});
