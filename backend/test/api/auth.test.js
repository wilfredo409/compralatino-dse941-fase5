import { SIN_BD, sufijo } from '../helpers.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

const email = `test.auth.${sufijo}@pruebas.compralatino.test`;
const password = 'Prueba1234!';

after(async () => {
  if (!SIN_BD) await pool.query('DELETE FROM usuarios WHERE email = $1', [email]);
  await pool.end();
});

test('GET /salud responde ok sin autenticación', async () => {
  const res = await request(app).get('/api/v1/salud');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('una ruta inexistente devuelve 404 con el formato de error uniforme', async () => {
  const res = await request(app).get('/api/v1/no-existe');
  assert.equal(res.status, 404);
  assert.equal(res.body.codigo, 'ERROR_NO_ENCONTRADO');
});

test('registro: crea la cuenta en pendiente_verificacion y no devuelve la contraseña', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/auth/registro').send({ email, password, nombre: 'Prueba', apellido: 'Auth' });
  assert.equal(res.status, 201);
  assert.equal(res.body.email, email);
  assert.equal(res.body.estado, 'pendiente_verificacion');
  assert.equal(res.body.password, undefined);
  assert.equal(res.body.password_hash, undefined);
});

test('registro: el correo repetido responde 409', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/auth/registro').send({ email, password, nombre: 'Otra', apellido: 'Vez' });
  assert.equal(res.status, 409);
  assert.equal(res.body.codigo, 'ERROR_CONFLICTO');
});

test('registro: valida campos obligatorios y la longitud de la contraseña', { skip: SIN_BD }, async () => {
  const sinNombre = await request(app).post('/api/v1/auth/registro').send({ email: `x.${sufijo}@pruebas.compralatino.test`, password });
  assert.equal(sinNombre.status, 400);
  assert.equal(sinNombre.body.codigo, 'ERROR_VALIDACION');

  const corta = await request(app).post('/api/v1/auth/registro').send({ email: `y.${sufijo}@pruebas.compralatino.test`, password: 'corta', nombre: 'A', apellido: 'B' });
  assert.equal(corta.status, 400);
});

test('login: con credenciales correctas entrega access y refresh token', { skip: SIN_BD }, async () => {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(res.status, 200);
  assert.ok(res.body.accessToken);
  assert.ok(res.body.refreshToken);
  assert.equal(res.body.expiraEn, 900);
});

test('login: credenciales incorrectas responden 401 con un mensaje claro y uniforme', { skip: SIN_BD }, async () => {
  const mala = await request(app).post('/api/v1/auth/login').send({ email, password: 'Incorrecta99!' });
  assert.equal(mala.status, 401);
  assert.equal(mala.body.mensaje, 'Correo o contraseña incorrectos');

  const inexistente = await request(app).post('/api/v1/auth/login').send({ email: `nadie.${sufijo}@pruebas.compralatino.test`, password });
  assert.equal(inexistente.status, 401);
  assert.equal(inexistente.body.mensaje, 'Correo o contraseña incorrectos');
});

test('refresh: un refresh token válido emite un par nuevo; un access token no sirve como refresh', { skip: SIN_BD }, async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  const ok = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.accessToken);

  const mal = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.accessToken });
  assert.equal(mal.status, 401);
});

test('rutas protegidas: sin token o con token inválido responden 401; con token válido pasan', { skip: SIN_BD }, async () => {
  const sin = await request(app).get('/api/v1/pedidos');
  assert.equal(sin.status, 401);
  const falso = await request(app).get('/api/v1/pedidos').set('Authorization', 'Bearer token-falso');
  assert.equal(falso.status, 401);

  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  const ok = await request(app).get('/api/v1/pedidos').set('Authorization', `Bearer ${login.body.accessToken}`);
  assert.equal(ok.status, 200);
});

test('el rol de cliente no accede al panel de administración (403)', { skip: SIN_BD }, async () => {
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  const res = await request(app).get('/api/v1/admin/metricas').set('Authorization', `Bearer ${login.body.accessToken}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.codigo, 'ERROR_AUTORIZACION');
});
