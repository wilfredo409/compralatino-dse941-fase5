import {
  SIN_BD,
  crearUsuarioConSesion,
  crearCatalogoDePrueba,
  crearDireccion,
  otorgarRolAdministrador,
  retirarRolAdministradorSiSobra,
  limpiar,
} from '../helpers.js';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Configuración específica de esta prueba.
// Debe definirse antes de cargar app/YAuctionsAdapter.
process.env.YAUCTIONS_FAILURE_RATE = '0';
process.env.YAUCTIONS_BREAKER_THRESHOLD = '5';
process.env.YAUCTIONS_BREAKER_COOLDOWN_MS = '150';

const { app } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');

let admin;
let usuario;
let idDireccion;
let subasta;
let pedido;

const auth = (u) => ({
  Authorization: `Bearer ${u.token}`,
});

const ofertar = (body) =>
  request(app)
    .post(`/api/v1/pedidos/${pedido.id}/ofertas`)
    .set(auth(usuario))
    .send(body);

const metricas = async () =>
  request(app)
    .get('/api/v1/admin/metricas')
    .set(auth(admin));

const contarPujas = async () =>
  Number(
    (
      await pool.query(
        'SELECT COUNT(*) AS total FROM pujas WHERE id_pedido = $1',
        [pedido.id]
      )
    ).rows[0].total
  );

before(async () => {
  if (SIN_BD) return;

  admin = await crearUsuarioConSesion(request, app, 'resiliencia-admin');
  await otorgarRolAdministrador(pool, admin.id);

  usuario = await crearUsuarioConSesion(request, app, 'resiliencia-cliente');
  idDireccion = await crearDireccion(pool, usuario.id);

  subasta = await crearCatalogoDePrueba(pool, 'resiliencia-subasta', {
    cantidad: 1,
    precioUsd: 300,
    stock: 0,
    tipoVenta: 'subasta',
  });

  const creado = await request(app)
    .post('/api/v1/pedidos')
    .set(auth(usuario))
    .send({
      idDireccion,
      items: [
        {
          idProducto: subasta.productos[0].id,
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
      idsUsuario: [admin?.id, usuario?.id].filter(Boolean),
      idCategoria: subasta?.idCategoria,
    });

    await retirarRolAdministradorSiSobra(pool);
  }

  await pool.end();
});

test(
  'Circuit Breaker: abre, rechaza sin guardar puja y se recupera tras el enfriamiento',
  { skip: SIN_BD },
  async (t) => {
    let instante = Date.now();
    t.mock.method(Date, 'now', () => instante);
    const inicial = await metricas();

    assert.equal(inicial.status, 200);
    assert.equal(inicial.body.integracionYAuctions.circuito, 'CERRADO');

    // Primer fallo: los reintentos internos acumulan 3 fallos.
    const fallo1 = await ofertar({
      idProducto: subasta.productos[0].id,
      montoJpy: 40000,
      simularFallo: true,
    });

    assert.equal(fallo1.status, 503);
    assert.equal(await contarPujas(), 0);

    // Segundo fallo: alcanza el umbral de 5 y abre el circuito.
    const fallo2 = await ofertar({
      idProducto: subasta.productos[0].id,
      montoJpy: 41000,
      simularFallo: true,
    });

    assert.equal(fallo2.status, 503);
    assert.equal(await contarPujas(), 0);

    const abierto = await metricas();

    assert.equal(abierto.status, 200);
    assert.equal(abierto.body.integracionYAuctions.circuito, 'ABIERTO');

    const llamadasAntes =
      abierto.body.integracionYAuctions.llamadas;

    // Con el circuito abierto se rechaza inmediatamente.
    const bloqueada = await ofertar({
      idProducto: subasta.productos[0].id,
      montoJpy: 42000,
    });

    assert.equal(bloqueada.status, 503);
    assert.equal(await contarPujas(), 0);

    const despuesBloqueada = await metricas();

    assert.equal(
      despuesBloqueada.body.integracionYAuctions.llamadas,
      llamadasAntes,
      'el circuito abierto no debe llamar nuevamente a YAuctions'
    );

    // Avanza el reloj del circuito sin depender de la carga de la base de datos.
    instante += 200;

    const recuperada = await ofertar({
      idProducto: subasta.productos[0].id,
      montoJpy: 43000,
    });

    assert.equal(recuperada.status, 202);
    assert.equal(await contarPujas(), 1);

    const final = await metricas();

    assert.equal(final.status, 200);
    assert.equal(final.body.integracionYAuctions.circuito, 'CERRADO');
  }
);
