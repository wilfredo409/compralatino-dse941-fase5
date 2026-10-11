import '../helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { codificarCursor, decodificarCursor, limiteDesdeQuery } from '../../src/utils/pagination.js';
import { emitirTokenPar, verificarToken } from '../../src/utils/jwt.js';

test('cursor: codificar y decodificar devuelve el mismo valor', () => {
  const cursor = codificarCursor('2026-10-01T10:00:00Z', 'abc-123');
  assert.deepEqual(decodificarCursor(cursor), { o: '2026-10-01T10:00:00Z', id: 'abc-123' });
});

test('cursor: un cursor corrupto o vacío se ignora (null)', () => {
  assert.equal(decodificarCursor('esto-no-es-un-cursor'), null);
  assert.equal(decodificarCursor(undefined), null);
});

test('limite: usa el valor por defecto si falta o es inválido, y respeta el máximo', () => {
  assert.equal(limiteDesdeQuery({}), 20);
  assert.equal(limiteDesdeQuery({ limite: 'abc' }), 20);
  assert.equal(limiteDesdeQuery({ limite: '-5' }), 20);
  assert.equal(limiteDesdeQuery({ limite: '50' }), 50);
  assert.equal(limiteDesdeQuery({ limite: '5000' }), 100);
});

test('jwt: el access token lleva sub/email y el refresh token se marca como tipo refresh', () => {
  const par = emitirTokenPar({ id: 'u-1', email: 'a@b.test' });
  const acceso = verificarToken(par.accessToken);
  const renovacion = verificarToken(par.refreshToken);
  assert.equal(acceso.sub, 'u-1');
  assert.equal(acceso.email, 'a@b.test');
  assert.equal(acceso.tipo, undefined);
  assert.equal(renovacion.tipo, 'refresh');
});

test('jwt: un token alterado no se acepta', () => {
  const { accessToken } = emitirTokenPar({ id: 'u-1', email: 'a@b.test' });
  assert.throws(() => verificarToken(accessToken.slice(0, -3) + 'abc'));
});
