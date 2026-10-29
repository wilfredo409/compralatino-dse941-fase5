import { SIN_BD, sufijo } from '../helpers.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

const emails = [
  `sec01.${sufijo}@pruebas.compralatino.test`,
  `sec02.${sufijo}@pruebas.compralatino.test`,
];

after(async () => {
  if (!SIN_BD) {
    await pool.query(
      'DELETE FROM usuarios WHERE email = ANY($1::varchar[])',
      [emails]
    );
  }

  await pool.end();
});

test(
  'SEC-01: registro rechaza nombre mayor a 80 caracteres con 400',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .post('/api/v1/auth/registro')
      .send({
        email: emails[0],
        password: 'Prueba1234!',
        nombre: 'A'.repeat(81),
        apellido: 'Prueba',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.codigo, 'ERROR_VALIDACION');
  }
);

test(
  'SEC-02: registro rechaza nombre con tipo incorrecto con 400',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .post('/api/v1/auth/registro')
      .send({
        email: emails[1],
        password: 'Prueba1234!',
        nombre: { mal: true },
        apellido: 'Prueba',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.codigo, 'ERROR_VALIDACION');
  }
);