import {
  SIN_BD,
  crearUsuarioConSesion,
  crearCatalogoDePrueba,
  crearDireccion,
  limpiar,
} from '../helpers.js';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let propietario;
let intruso;
let catalogo;
let idDireccion;
let pedido;

const auth = (usuario) => ({
  Authorization: `Bearer ${usuario.token}`,
});

before(async () => {
  if (SIN_BD) return;

  propietario = await crearUsuarioConSesion(
    request,
    app,
    'seguridad-propietario'
  );

  intruso = await crearUsuarioConSesion(
    request,
    app,
    'seguridad-intruso'
  );

  idDireccion = await crearDireccion(pool, propietario.id);

  catalogo = await crearCatalogoDePrueba(pool, 'seguridad', {
    cantidad: 1,
    precioUsd: 25,
    stock: 10,
  });

  const creado = await request(app)
    .post('/api/v1/pedidos')
    .set(auth(propietario))
    .send({
      idDireccion,
      items: [
        {
          idProducto: catalogo.productos[0].id,
          cantidad: 1,
        },
      ],
    });

  assert.equal(creado.status, 201);
  pedido = creado.body;
});

after(async () => {
  if (!SIN_BD) {
    await limpiar(pool, {
      idsUsuario: [propietario?.id, intruso?.id].filter(Boolean),
      idCategoria: catalogo?.idCategoria,
    });
  }

  await pool.end();
});

test(
  'autorización: un cliente no puede acceder al panel administrativo',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .get('/api/v1/admin/metricas')
      .set(auth(propietario));

    assert.equal(res.status, 403);
    assert.equal(res.body.codigo, 'ERROR_AUTORIZACION');
  }
);

test(
  'IDOR: un usuario no puede utilizar la dirección de otro usuario',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .post('/api/v1/pedidos')
      .set(auth(intruso))
      .send({
        idDireccion,
        items: [
          {
            idProducto: catalogo.productos[0].id,
            cantidad: 1,
          },
        ],
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.codigo, 'ERROR_VALIDACION');
  }
);

test(
  'IDOR: un usuario no ve pedidos ajenos en su listado',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .get('/api/v1/pedidos?limite=100')
      .set(auth(intruso));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));

    const pedidoAjeno = res.body.items.find(
      (item) => item.id === pedido.id
    );

    assert.equal(pedidoAjeno, undefined);
  }
);

test(
  'IDOR: un usuario no puede pagar el pedido de otro usuario',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .post(`/api/v1/pedidos/${pedido.id}/pago`)
      .set(auth(intruso))
      .send({
        proveedor: 'demo-gateway',
        tokenPago: 'tok_intento_idor',
      });

    assert.equal(res.status, 404);
  }
);

test(
  'JWT: token ausente, manipulado y expirado responden 401',
  { skip: SIN_BD },
  async () => {
    const sinToken = await request(app)
      .get('/api/v1/pedidos');

    assert.equal(sinToken.status, 401);

    const partes = propietario.token.split('.');

    partes[2] =
      (partes[2][0] === 'a' ? 'b' : 'a') +
      partes[2].slice(1);

    const tokenManipulado = partes.join('.');

    const manipulado = await request(app)
      .get('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenManipulado}`);

    assert.equal(manipulado.status, 401);

    const tokenExpirado = jwt.sign(
      {
        sub: propietario.id,
        email: propietario.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: -1,
      }
    );

    const expirado = await request(app)
      .get('/api/v1/pedidos')
      .set('Authorization', `Bearer ${tokenExpirado}`);

    assert.equal(expirado.status, 401);
  }
);

test(
  'SQL injection: una cadena maliciosa en login no altera la consulta',
  { skip: SIN_BD },
  async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: "x' OR '1'='1",
        password: 'Incorrecta99!',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.codigo, 'ERROR_AUTENTICACION');

    const comprobacion = await pool.query(
      'SELECT COUNT(*)::int AS total FROM usuarios'
    );

    assert.ok(comprobacion.rows[0].total >= 2);
  }
);

test(
  'contraseñas: se almacenan con bcrypt y el hash no se expone por la API',
  { skip: SIN_BD },
  async () => {
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [propietario.id]
    );

    assert.equal(rows.length, 1);

    const hash = rows[0].password_hash;

    assert.notEqual(hash, propietario.password);
    assert.match(hash, /^\$2[aby]\$/);

    const perfil = await request(app)
      .get('/api/v1/usuarios/me')
      .set(auth(propietario));

    assert.equal(perfil.status, 200);
    assert.equal('password' in perfil.body, false);
    assert.equal('password_hash' in perfil.body, false);
  }
);