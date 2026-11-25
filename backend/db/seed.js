/**
 * Seed de datos de demostración para Fase 3 (supuestos_fase3.md #3):
 * no hay acceso real a YAuctions, así que se genera un catálogo de ejemplo,
 * usuarios demo con historial de compras/navegación (para poder mostrar el
 * motor de recomendaciones) y un usuario administrador.
 *
 * Uso: npm run seed   (requiere DATABASE_URL apuntando a una BD donde ya se
 * corrió schema.sql de Fase 2 y la migración 001_pedido_codigo_seq.sql)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/config/db.js';
import { cargarCatalogoDemo } from './catalogo-demo.js';

const USUARIOS_DEMO = [
  { email: 'laura.pineda@demo.compralatino.com', nombre: 'Laura', apellido: 'Pineda', comprasEn: ['Relojería', 'Coleccionables'] },
  { email: 'fernando.lopez@demo.compralatino.com', nombre: 'Fernando', apellido: 'López', comprasEn: ['Cámaras', 'Lentes y accesorios'] },
  { email: 'lucia.hernandez@demo.compralatino.com', nombre: 'Lucía', apellido: 'Hernández', comprasEn: [] }, // sin compras: prueba de fallback por navegación
  { email: 'david.cardona@demo.compralatino.com', nombre: 'David', apellido: 'Cardona', comprasEn: [] }, // sin compras ni navegación: prueba fallback global
  { email: 'edwin.ceron@demo.compralatino.com', nombre: 'Edwin', apellido: 'Cerón', comprasEn: ['Instrumentos'] },
];

function tasaAUsd(jpy, tasa = 152.4, margen = 0.03) {
  return Math.round((jpy / tasa) * (1 + margen) * 100) / 100;
}

async function main() {
  console.log('Sembrando datos de demostración de CompraLatino (Fase 3)...');

  await withTransaction(async (client) => {
    // Idempotencia simple: si ya hay categorías, no volver a sembrar.
    const { rows: existentes } = await client.query('SELECT COUNT(*)::int AS n FROM categorias');
    if (existentes[0].n > 0) {
      console.log('Ya existen datos (categorías > 0). Saltando seed para no duplicar.');
      return;
    }

    // Roles
    const rolCliente = await client.query("INSERT INTO roles (nombre, descripcion) VALUES ('cliente','Compra en la plataforma') RETURNING id");
    const rolAdmin = await client.query("INSERT INTO roles (nombre, descripcion) VALUES ('administrador','Gestión y monitoreo (M5)') RETURNING id");

    // Tipo de cambio vigente (ver wireframe W06: JPY/USD 152.40, margen 3%)
    await client.query(
      `INSERT INTO tipo_cambio (moneda_origen, moneda_destino, tasa, margen) VALUES ('JPY','USD',152.40,0.03)`
    );

    const productosPorCategoria = await cargarCatalogoDemo(client);
    const todosLosProductos = Object.values(productosPorCategoria).flat();

    // Usuarios demo + admin
    const hashDemo = await bcrypt.hash('Demo1234!', 10);
    const idsUsuarios = {};
    for (const u of USUARIOS_DEMO) {
      const { rows } = await client.query(
        `INSERT INTO usuarios (email, password_hash, nombre, apellido, estado) VALUES ($1,$2,$3,$4,'activo') RETURNING id`,
        [u.email, hashDemo, u.nombre, u.apellido]
      );
      idsUsuarios[u.email] = rows[0].id;
      await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1,$2)', [rows[0].id, rolCliente.rows[0].id]);
      await client.query(
        `INSERT INTO direcciones (id_usuario, pais, departamento, ciudad, detalle, es_principal)
         VALUES ($1,'El Salvador','San Salvador','San Salvador','Colonia Escalón, calle demo #123', true)`,
        [rows[0].id]
      );
    }

    const hashAdmin = await bcrypt.hash('Admin1234!', 10);
    const { rows: adminRows } = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, estado)
       VALUES ('admin@compralatino.com',$1,'Admin','CompraLatino','activo') RETURNING id`,
      [hashAdmin]
    );
    await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1,$2)', [adminRows[0].id, rolAdmin.rows[0].id]);
    await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1,$2)', [adminRows[0].id, rolCliente.rows[0].id]);

    // Historial de compras (pedidos "pagado", con fecha_creacion repartida en
    // los últimos 25 días para que se reflejen en las métricas del admin) para
    // los usuarios que sí tienen `comprasEn`, y navegación para el que no
    // compró pero sí visitó (Lucía).
    let contadorPedidos = 1;
    for (const u of USUARIOS_DEMO) {
      const idUsuario = idsUsuarios[u.email];
      const { rows: dirRows } = await client.query('SELECT id FROM direcciones WHERE id_usuario = $1', [idUsuario]);

      for (const nombreCat of u.comprasEn) {
        const candidatos = productosPorCategoria[nombreCat] || [];
        const producto = candidatos[Math.floor(Math.random() * candidatos.length)];
        if (!producto) continue;
        const { rows: prodRows } = await client.query('SELECT precio_usd, tipo_venta FROM productos WHERE id = $1', [producto]);
        if (prodRows[0].tipo_venta !== 'fijo') continue; // los pedidos de ejemplo solo usan productos de precio fijo
        const precio = Number(prodRows[0].precio_usd);
        const subtotal = precio;
        const flete = 12;
        const comision = Math.round(subtotal * 0.05 * 100) / 100;
        const total = Math.round((subtotal + flete + comision) * 100) / 100;
        const fecha = new Date(Date.now() - Math.random() * 25 * 24 * 3600 * 1000);

        const codigo = `CL-${fecha.getFullYear()}-${String(1000 + contadorPedidos++).padStart(4, '0')}`;
        const { rows: pedidoRows } = await client.query(
          `INSERT INTO pedidos (codigo, id_usuario, id_direccion, estado, subtotal_usd, flete_usd, comision_usd, total_usd, fecha_creacion)
           VALUES ($1,$2,$3,'pagado',$4,$5,$6,$7,$8) RETURNING id`,
          [codigo, idUsuario, dirRows[0].id, subtotal.toFixed(2), flete.toFixed(2), comision.toFixed(2), total.toFixed(2), fecha]
        );
        await client.query(
          `INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario_usd) VALUES ($1,$2,1,$3)`,
          [pedidoRows[0].id, producto, precio.toFixed(2)]
        );
        await client.query(
          `INSERT INTO pagos (id_pedido, proveedor, token_transaccion, monto, estado, fecha) VALUES ($1,'demo-gateway',$2,$3,'capturado',$4)`,
          [pedidoRows[0].id, `tok_demo_${pedidoRows[0].id.slice(0, 8)}`, total.toFixed(2), fecha]
        );
      }
    }

    // Un pedido con pago rechazado, para que el panel admin muestre "pedidos
    // que requieren atención" (ver W06) con datos reales. Coherente con el
    // webhook de pagos (webhooks.routes.js): cuando el pago se rechaza, el
    // pedido pasa a 'cancelado'. Así el cliente ve «Cancelado» en «Mis pedidos»
    // y el panel admin lo lista con el motivo «Pago rechazado».
    const laura = idsUsuarios['laura.pineda@demo.compralatino.com'];
    const { rows: dirLaura } = await client.query('SELECT id FROM direcciones WHERE id_usuario = $1', [laura]);
    const productoBarato = productosPorCategoria['Instrumentos'].find(Boolean);
    const { rows: prodBarato } = await client.query('SELECT precio_usd FROM productos WHERE id = $1', [productoBarato]);
    const totalRechazado = Number(prodBarato[0].precio_usd) + 12 + Math.round(Number(prodBarato[0].precio_usd) * 0.05 * 100) / 100;
    const { rows: pedidoRechazado } = await client.query(
      `INSERT INTO pedidos (codigo, id_usuario, id_direccion, estado, subtotal_usd, flete_usd, comision_usd, total_usd)
       VALUES ($1,$2,$3,'cancelado',$4,12,$5,$6) RETURNING id`,
      [`CL-${new Date().getFullYear()}-0099`, laura, dirLaura[0].id, prodBarato[0].precio_usd, (Number(prodBarato[0].precio_usd) * 0.05).toFixed(2), totalRechazado.toFixed(2)]
    );
    await client.query(
      `INSERT INTO pagos (id_pedido, proveedor, token_transaccion, monto, estado) VALUES ($1,'demo-gateway','tok_demo_rechazo',$2,'rechazado')`,
      [pedidoRechazado[0].id, totalRechazado.toFixed(2)]
    );

    // Navegación de Lucía (sin compras) para probar el fallback de recomendaciones
    const lucia = idsUsuarios['lucia.hernandez@demo.compralatino.com'];
    for (const idProd of (productosPorCategoria['Electrónica'] || []).slice(0, 3)) {
      await client.query('INSERT INTO historial_navegacion (id_usuario, id_producto) VALUES ($1,$2)', [lucia, idProd]);
    }

    // Pujas históricas resueltas, para que "éxito de ofertas" no salga vacío
    // Laura compra en Relojería y Coleccionables; estas categorías alimentan
    // sus recomendaciones personalizadas incluso al recrear el catálogo.
    const idsProductosParaPujas = [
      ...(productosPorCategoria['Relojería'] || []),
      ...(productosPorCategoria['Coleccionables'] || []),
    ];
    const { rows: subastasRows } = await client.query(
      `SELECT id FROM productos
       WHERE tipo_venta = 'subasta' AND id = ANY($1::uuid[])`,
      [idsProductosParaPujas]
    );
    const idsSubastas = new Set(subastasRows.map((row) => row.id));
    const subastas = idsProductosParaPujas.filter((id) => idsSubastas.has(id));
    const estadosDemo = ['aceptada', 'aceptada', 'rechazada', 'superada'];
    for (let idx = 0; idx < subastas.length; idx++) {
      const montoJpy = 10000 + idx * 500;
      const precioUsd = tasaAUsd(montoJpy);
      const subtotal = precioUsd;
      const flete = 12;
      const comision = Math.round(subtotal * 0.05 * 100) / 100;
      const total = Math.round((subtotal + flete + comision) * 100) / 100;
      const pedidoDePuja = await client.query(
        `INSERT INTO pedidos (codigo, id_usuario, id_direccion, estado, subtotal_usd, flete_usd, comision_usd, total_usd)
         VALUES ($1,$2,$3,'en_proceso',$4,$5,$6,$7) RETURNING id`,
        [
          `CL-${new Date().getFullYear()}-${String(9000 + idx).padStart(4, '0')}`,
          laura,
          dirLaura[0].id,
          subtotal.toFixed(2),
          flete.toFixed(2),
          comision.toFixed(2),
          total.toFixed(2),
        ]
      );
      await client.query(
        `INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario_usd)
         VALUES ($1,$2,1,$3)`,
        [pedidoDePuja.rows[0].id, subastas[idx], precioUsd.toFixed(2)]
      );
      await client.query(
        `INSERT INTO pujas (id_pedido, id_producto, monto_jpy, estado) VALUES ($1,$2,$3,$4)`,
        [pedidoDePuja.rows[0].id, subastas[idx], montoJpy, estadosDemo[idx]]
      );
    }

    console.log(`Listo: ${Object.keys(productosPorCategoria).length} categorías, ${todosLosProductos.length} productos, ${USUARIOS_DEMO.length} usuarios demo + 1 admin.`);
    console.log('Login admin: admin@compralatino.com / Admin1234!');
    console.log('Login demo:  laura.pineda@demo.compralatino.com / Demo1234!  (y los otros 4 usuarios listados en db/seed.js)');
  });

  await pool.end();
}

main().catch((err) => {
  console.error('Error sembrando datos:', err);
  process.exit(1);
});
