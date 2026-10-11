// RF-02 · Catálogo (M2): búsqueda con filtros, paginación por cursor, ficha de producto y árbol de categorías.
import { SIN_BD, sufijo, crearCatalogoDePrueba, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let fijos, subastas, idPadre, idHija;

before(async () => {
  if (SIN_BD) return;
  fijos = await crearCatalogoDePrueba(pool, 'cat-fijo', { cantidad: 3, precioUsd: 40, stock: 5 });
  subastas = await crearCatalogoDePrueba(pool, 'cat-subasta', { cantidad: 1, precioUsd: 300, stock: 0, tipoVenta: 'subasta' });
  // Árbol de categorías: una raíz con una subcategoría.
  idPadre = (await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [`Padre ${sufijo}`])).rows[0].id;
  idHija = (await pool.query('INSERT INTO categorias (nombre, id_padre) VALUES ($1, $2) RETURNING id', [`Hija ${sufijo}`, idPadre])).rows[0].id;
  // Una imagen para la ficha del primer producto.
  await pool.query('INSERT INTO producto_imagenes (id_producto, url_blob, orden) VALUES ($1, $2, 1)', [fijos.productos[0].id, 'https://ejemplo.test/img1.png']);
});

after(async () => {
  if (!SIN_BD) {
    await pool.query('DELETE FROM categorias WHERE id = ANY($1::int[])', [[idHija, idPadre]]);
    await limpiar(pool, { idCategoria: fijos?.idCategoria });
    await limpiar(pool, { idCategoria: subastas?.idCategoria });
  }
  await pool.end();
});

test('catálogo: filtra por categoría y trae los productos con los campos del contrato', { skip: SIN_BD }, async () => {
  const res = await request(app).get(`/api/v1/productos?categoria=${fijos.idCategoria}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 3);
  const p = res.body.items[0];
  for (const campo of ['id', 'titulo', 'precioJpy', 'precioUsd', 'tipoVenta', 'stock', 'imagenes']) assert.ok(campo in p, campo);
  assert.equal(p.precioUsd, 40);
  assert.equal(p.tipoVenta, 'fijo');
});

test('catálogo: filtra por tipo de venta, por rango de precio y por texto', { skip: SIN_BD }, async () => {
  const soloSubasta = await request(app).get(`/api/v1/productos?categoria=${subastas.idCategoria}&tipoVenta=subasta`);
  assert.equal(soloSubasta.body.items.length, 1);
  assert.equal(soloSubasta.body.items[0].tipoVenta, 'subasta');

  const fijoEnSubasta = await request(app).get(`/api/v1/productos?categoria=${subastas.idCategoria}&tipoVenta=fijo`);
  assert.equal(fijoEnSubasta.body.items.length, 0);

  const caros = await request(app).get(`/api/v1/productos?categoria=${fijos.idCategoria}&precioMin=100`);
  assert.equal(caros.body.items.length, 0, 'los productos de 40 USD no pasan el mínimo de 100');
  const baratos = await request(app).get(`/api/v1/productos?categoria=${fijos.idCategoria}&precioMax=50`);
  assert.equal(baratos.body.items.length, 3);

  const porTexto = await request(app).get(`/api/v1/productos?q=${encodeURIComponent('PRODUCTO DE PRUEBA cat-fijo 1')}`);
  assert.equal(porTexto.body.items.length, 1, 'la búsqueda por título no distingue mayúsculas');
});

test('catálogo: pagina por cursor sin repetir ni omitir productos', { skip: SIN_BD }, async () => {
  const vistos = [];
  let cursor = null;
  for (let pagina = 0; pagina < 5; pagina++) {
    const url = `/api/v1/productos?categoria=${fijos.idCategoria}&limite=2${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await request(app).get(url);
    assert.equal(res.status, 200);
    vistos.push(...res.body.items.map((p) => p.id));
    cursor = res.body.cursorSiguiente;
    if (!cursor) break;
  }
  assert.equal(vistos.length, 3);
  assert.equal(new Set(vistos).size, 3, 'ninguna página repite productos');
  assert.deepEqual([...vistos].sort(), fijos.productos.map((p) => p.id).sort());
});

test('ficha de producto: devuelve el detalle con sus imágenes', { skip: SIN_BD }, async () => {
  const res = await request(app).get(`/api/v1/productos/${fijos.productos[0].id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, fijos.productos[0].id);
  assert.deepEqual(res.body.imagenes, ['https://ejemplo.test/img1.png']);
});

test('ficha de producto: 404 si no existe y 400 (no 500) si el identificador no es válido', { skip: SIN_BD }, async () => {
  const noExiste = await request(app).get('/api/v1/productos/00000000-0000-0000-0000-000000000000');
  assert.equal(noExiste.status, 404);
  assert.equal(noExiste.body.codigo, 'ERROR_NO_ENCONTRADO');

  const malFormado = await request(app).get('/api/v1/productos/no-es-un-uuid');
  assert.equal(malFormado.status, 400);
  assert.equal(malFormado.body.codigo, 'ERROR_VALIDACION');
});

test('categorías: devuelve el árbol con las subcategorías anidadas', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/categorias');
  assert.equal(res.status, 200);
  const padre = res.body.find((c) => c.id === idPadre);
  assert.ok(padre, 'la categoría raíz está en el primer nivel');
  assert.equal(padre.subcategorias.length, 1);
  assert.equal(padre.subcategorias[0].id, idHija);
  assert.equal(padre.subcategorias[0].idPadre, idPadre);
  assert.ok(!res.body.some((c) => c.id === idHija), 'la subcategoría no aparece suelta en el primer nivel');
});
