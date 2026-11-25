import './helpers.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.CORS_ALLOWED_ORIGINS = 'https://operacion.example.test';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
after(() => pool.end());

test('CORS concede permiso solo al origen configurado', async () => {
  const ruta = '/api/v1/salud';
  const permitido = 'https://operacion.example.test';
  const res = await request(app).options(ruta).set('Origin', permitido)
    .set('Access-Control-Request-Method', 'GET');
  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], permitido);

  const externo = await request(app).get(ruta).set('Origin', 'https://otro.example.test');
  assert.equal(externo.status, 200);
  assert.equal(externo.headers['access-control-allow-origin'], undefined);
});

test('salud de aplicación y disponibilidad de PostgreSQL tienen contratos distintos', async () => {
  const salud = await request(app).get('/api/v1/salud');
  assert.equal(salud.status, 200);
  assert.equal(salud.body.ok, true);
  const listo = await request(app).get('/api/v1/salud/listo');
  assert.equal(listo.status, process.env.DATABASE_URL ? 200 : 503);
  assert.equal(listo.headers['cache-control'], 'no-store');
});
