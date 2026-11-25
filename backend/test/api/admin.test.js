// RF-05 · Administración (M5): métricas, listados, reporte CSV, gestión de usuarios y auditoría.
import { SIN_BD, crearUsuarioConSesion, crearCatalogoDePrueba, crearDireccion, otorgarRolAdministrador, retirarRolAdministradorSiSobra, limpiar } from '../helpers.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

let admin, cliente, objetivo, catalogo, idDireccion, pedido;
const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const firmar = (cuerpo) => crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(JSON.stringify(cuerpo)).digest('hex');

before(async () => {
  if (SIN_BD) return;
  admin = await crearUsuarioConSesion(request, app, 'admin');
  await otorgarRolAdministrador(pool, admin.id);
  cliente = await crearUsuarioConSesion(request, app, 'cliente-admin');
  objetivo = await crearUsuarioConSesion(request, app, 'objetivo');
  idDireccion = await crearDireccion(pool, cliente.id);
  catalogo = await crearCatalogoDePrueba(pool, 'admin', { cantidad: 1, precioUsd: 50, stock: 5 });

  // Un pedido pagado y luego rechazado por la pasarela: debe aparecer como «requiere atención».
  const creado = await request(app).post('/api/v1/pedidos').set(auth(cliente))
    .send({ idDireccion, items: [{ idProducto: catalogo.productos[0].id, cantidad: 1 }] });
  pedido = creado.body;
  await request(app).post(`/api/v1/pedidos/${pedido.id}/pago`).set(auth(cliente))
    .send({ proveedor: 'demo-gateway', tokenPago: 'tok_admin_rechazo' });
  const cuerpo = { idPedido: pedido.id, estadoPago: 'rechazado' };
  await request(app).post('/api/v1/webhooks/pagos').set('x-signature', firmar(cuerpo)).send(cuerpo);

  // Un segundo pedido, sin pagar, para poder probar la paginación del listado.
  await request(app).post('/api/v1/pedidos').set(auth(cliente))
    .send({ idDireccion, items: [{ idProducto: catalogo.productos[0].id, cantidad: 1 }] });
});

after(async () => {
  if (!SIN_BD) {
    await limpiar(pool, { idsUsuario: [admin?.id, cliente?.id, objetivo?.id].filter(Boolean), idCategoria: catalogo?.idCategoria });
    await retirarRolAdministradorSiSobra(pool);
  }
  await pool.end();
});

test('sin token todo el panel responde 401', { skip: SIN_BD }, async () => {
  for (const ruta of ['/metricas', '/pedidos', '/usuarios', '/auditoria', '/reportes/transacciones']) {
    const res = await request(app).get(`/api/v1/admin${ruta}`);
    assert.equal(res.status, 401, ruta);
  }
});

test('un cliente no puede usar ninguna ruta del panel (403)', { skip: SIN_BD }, async () => {
  for (const ruta of ['/pedidos', '/usuarios', '/auditoria', '/reportes/transacciones']) {
    const res = await request(app).get(`/api/v1/admin${ruta}`).set(auth(cliente));
    assert.equal(res.status, 403, ruta);
  }
});

test('métricas: devuelve las tarjetas del wireframe W06 con el formato esperado', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/admin/metricas').set(auth(admin));
  assert.equal(res.status, 200);
  assert.equal(res.body.periodoDias, 30);
  for (const campo of ['ventasUsd', 'pedidos', 'ticketPromedioUsd']) {
    assert.equal(typeof res.body[campo], 'number', campo);
  }
  assert.ok(res.body.usuarios.registrados >= 3, 'cuenta al menos a los usuarios creados por la prueba');
  assert.ok(['CERRADO', 'ABIERTO', 'SEMI_ABIERTO'].includes(res.body.integracionYAuctions.circuito));
  assert.ok(Array.isArray(res.body.pedidosQueRequierenAtencion));
});

test('métricas: un pedido con pago rechazado aparece en «requieren atención»', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/admin/metricas').set(auth(admin));
  const fila = res.body.pedidosQueRequierenAtencion.find((p) => p.codigo === pedido.codigo);
  assert.ok(fila, 'el pedido rechazado debe estar en la lista');
  assert.equal(fila.motivo, 'Pago rechazado');
  assert.equal(fila.montoUsd, pedido.totalUsd);
});

test('cuadro de mando: restringe el rol y compara periodos admitidos', { skip: SIN_BD }, async () => {
  const ruta = '/api/v1/admin/cuadro-mando';
  assert.equal((await request(app).get(ruta)).status, 401);
  assert.equal((await request(app).get(ruta).set(auth(cliente))).status, 403);
  assert.equal((await request(app).get(`${ruta}?dias=13`).set(auth(admin))).status, 400);
  const res = await request(app).get(`${ruta}?dias=7`).set(auth(admin));
  assert.equal(res.status, 200);
  assert.equal(res.body.dias, 7);
  for (const periodo of [res.body.actual, res.body.anterior]) {
    assert.ok(periodo.ventasUsd >= 0);
    assert.ok(periodo.compradores <= periodo.pedidos);
    assert.ok(periodo.pedidosEntregadosPorcentaje === null || periodo.pedidosEntregadosPorcentaje <= 100);
  }
});

test('pedidos: lista paginada por cursor y filtra por estado', { skip: SIN_BD }, async () => {
  const filtrados = await request(app).get('/api/v1/admin/pedidos?estado=cancelado&limite=100').set(auth(admin));
  assert.equal(filtrados.status, 200);
  assert.ok(filtrados.body.items.length >= 1);
  assert.ok(filtrados.body.items.every((p) => p.estado === 'cancelado'));
  assert.ok(filtrados.body.items.some((p) => p.codigo === pedido.codigo));

  const primera = await request(app).get('/api/v1/admin/pedidos?limite=1').set(auth(admin));
  assert.equal(primera.body.items.length, 1);
  assert.ok(primera.body.cursorSiguiente, 'con más de un pedido debe haber cursor para la siguiente página');
  const segunda = await request(app).get(`/api/v1/admin/pedidos?limite=1&cursor=${primera.body.cursorSiguiente}`).set(auth(admin));
  assert.equal(segunda.body.items.length, 1);
  assert.notEqual(segunda.body.items[0].id, primera.body.items[0].id);
});

test('reporte de transacciones: exporta CSV con encabezado y el pago del pedido', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/admin/reportes/transacciones').set(auth(admin));
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /transacciones\.csv/);
  const lineas = res.text.split('\n');
  assert.equal(lineas[0], 'id,pedido_codigo,proveedor,monto,estado,fecha');
  const lineaPedido = lineas.find((l) => l.includes(pedido.codigo));
  assert.ok(lineaPedido, 'el pago del pedido debe estar en el CSV');
  assert.match(lineaPedido, /demo-gateway,.*rechazado/);

  const futuro = await request(app).get('/api/v1/admin/reportes/transacciones?desde=2999-01-01').set(auth(admin));
  assert.equal(futuro.text, 'id,pedido_codigo,proveedor,monto,estado,fecha', 'un rango sin pagos solo trae el encabezado');
});

test('usuarios: lista paginada sin exponer la contraseña', { skip: SIN_BD }, async () => {
  const res = await request(app).get('/api/v1/admin/usuarios?limite=100').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.items.some((u) => u.email === objetivo.email));
  assert.ok(res.body.items.every((u) => !('password' in u) && !('passwordHash' in u) && !('password_hash' in u)));
});

test('usuarios (PUT): valida los datos y responde 404 si el usuario no existe', { skip: SIN_BD }, async () => {
  const sinId = await request(app).put('/api/v1/admin/usuarios').set(auth(admin)).send({ estado: 'activo' });
  assert.equal(sinId.status, 400);
  const estadoMalo = await request(app).put('/api/v1/admin/usuarios').set(auth(admin)).send({ id: objetivo.id, estado: 'inventado' });
  assert.equal(estadoMalo.status, 400);
  const inexistente = await request(app).put('/api/v1/admin/usuarios').set(auth(admin))
    .send({ id: '00000000-0000-0000-0000-000000000000', estado: 'activo' });
  assert.equal(inexistente.status, 404);
});

test('usuarios (PUT): suspender una cuenta le corta el acceso y queda en la auditoría', { skip: SIN_BD }, async () => {
  const antes = await request(app).get('/api/v1/usuarios/me').set(auth(objetivo));
  assert.equal(antes.status, 200);

  const res = await request(app).put('/api/v1/admin/usuarios').set(auth(admin)).send({ id: objetivo.id, estado: 'suspendido' });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'suspendido');

  const despues = await request(app).get('/api/v1/usuarios/me').set(auth(objetivo));
  assert.equal(despues.status, 401, 'la cuenta suspendida ya no puede usar su token');

  const audit = await request(app).get('/api/v1/admin/auditoria?limite=100').set(auth(admin));
  assert.equal(audit.status, 200);
  const registro = audit.body.items.find((a) => a.accion === 'ACTUALIZAR_USUARIO' && a.idEntidad === objetivo.id);
  assert.ok(registro, 'el cambio de estado debe quedar auditado');
  assert.equal(registro.idUsuario, admin.id);

  const reactivar = await request(app).put('/api/v1/admin/usuarios').set(auth(admin)).send({ id: objetivo.id, estado: 'activo' });
  assert.equal(reactivar.body.estado, 'activo');
  assert.equal((await request(app).get('/api/v1/usuarios/me').set(auth(objetivo))).status, 200);
});

test('auditoría: pagina con cursor', { skip: SIN_BD }, async () => {
  const primera = await request(app).get('/api/v1/admin/auditoria?limite=1').set(auth(admin));
  assert.equal(primera.body.items.length, 1);
  assert.ok(primera.body.cursorSiguiente);
  const segunda = await request(app).get(`/api/v1/admin/auditoria?limite=1&cursor=${primera.body.cursorSiguiente}`).set(auth(admin));
  assert.notEqual(segunda.body.items[0].id, primera.body.items[0].id);
});
