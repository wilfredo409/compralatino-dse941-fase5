// RF-01 · Cuentas (M1): perfil y direcciones del usuario autenticado.
import { SIN_BD, crearUsuarioConSesion, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let usuario;
const auth = () => ({ Authorization: `Bearer ${usuario.token}` });
const direccion = (extra = {}) => ({ pais: 'El Salvador', departamento: 'La Libertad', ciudad: 'Santa Tecla', detalle: 'Calle de pruebas 123', ...extra });

before(async () => {
  if (SIN_BD) return;
  usuario = await crearUsuarioConSesion(request, app, 'perfil');
});

after(async () => {
  if (!SIN_BD) await limpiar(pool, { idsUsuario: [usuario?.id].filter(Boolean) });
  await pool.end();
});

test('perfil: exige autenticación', { skip: SIN_BD }, async () => {
  assert.equal((await request(app).get('/api/v1/usuarios/me')).status, 401);
  assert.equal((await request(app).put('/api/v1/usuarios/me').send({ nombre: 'A', apellido: 'B' })).status, 401);
});

test('perfil: GET devuelve los datos del usuario, sin direcciones al inicio y sin contraseña', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/usuarios/me').set(auth());
  assert.equal(res.status, 200);
  assert.equal(res.body.id, usuario.id);
  assert.equal(res.body.email, usuario.email);
  assert.deepEqual(res.body.direcciones, []);
  assert.ok(!('password_hash' in res.body) && !('password' in res.body));
});

test('perfil: PUT exige nombre y apellido', { skip: SIN_BD }, async () => {
  const res = await request(app).put('/api/v1/usuarios/me').set(auth()).send({ nombre: 'Solo nombre' });
  assert.equal(res.status, 400);
  assert.equal(res.body.codigo, 'ERROR_VALIDACION');
});

test('perfil: PUT actualiza los datos y reemplaza las direcciones', { skip: SIN_BD }, async () => {
  const res = await request(app).put('/api/v1/usuarios/me').set(auth()).send({
    nombre: 'Nuevo', apellido: 'Nombre', telefono: '+503 7000-0000',
    direcciones: [direccion({ esPrincipal: true }), direccion({ ciudad: 'San Salvador' })],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Nuevo');
  assert.equal(res.body.telefono, '+503 7000-0000');
  assert.equal(res.body.direcciones.length, 2);
  assert.equal(res.body.direcciones.filter((d) => d.esPrincipal).length, 1);

  // Enviar otra lista sustituye a la anterior (no se acumulan).
  const reemplazo = await request(app).put('/api/v1/usuarios/me').set(auth()).send({
    nombre: 'Nuevo', apellido: 'Nombre', direcciones: [direccion({ ciudad: 'Soyapango' })],
  });
  assert.equal(reemplazo.body.direcciones.length, 1);
  assert.equal(reemplazo.body.direcciones[0].ciudad, 'Soyapango');
  assert.equal(reemplazo.body.telefono, null, 'sin teléfono en el cuerpo, el campo se limpia');
});

test('perfil: una dirección incompleta cancela TODO el cambio (transacción atómica)', { skip: SIN_BD }, async () => {
  const antes = await request(app).get('/api/v1/usuarios/me').set(auth());
  const res = await request(app).put('/api/v1/usuarios/me').set(auth()).send({
    nombre: 'No debe guardarse', apellido: 'Tampoco',
    direcciones: [direccion(), { pais: 'El Salvador' }],
  });
  assert.equal(res.status, 400);

  const despues = await request(app).get('/api/v1/usuarios/me').set(auth());
  assert.equal(despues.body.nombre, antes.body.nombre, 'el nombre no cambió');
  assert.deepEqual(despues.body.direcciones, antes.body.direcciones, 'las direcciones anteriores siguen intactas');
});

test('perfil: editar una dirección guardada conserva su identificador', { skip: SIN_BD }, async () => {
  const creado = await request(app).put('/api/v1/usuarios/me').set(auth()).send({
    nombre: 'Nombre', apellido: 'Prueba', direcciones: [direccion({ esPrincipal: true })],
  });
  const guardada = creado.body.direcciones[0];
  const actualizado = await request(app).put('/api/v1/usuarios/me').set(auth()).send({
    nombre: 'Nombre', apellido: 'Prueba', direcciones: [{ ...guardada, detalle: 'Detalle actualizado' }],
  });
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.body.direcciones[0].id, guardada.id);
  assert.equal(actualizado.body.direcciones[0].detalle, 'Detalle actualizado');
});
