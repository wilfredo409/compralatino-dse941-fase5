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

const CATEGORIAS = [
  { nombre: 'Cámaras', hijos: ['Lentes y accesorios'] },
  { nombre: 'Electrónica' },
  { nombre: 'Relojería' },
  { nombre: 'Coleccionables' },
  { nombre: 'Instrumentos' },
];

// tipoVenta: 'fijo' | 'subasta'
const PRODUCTOS_POR_CATEGORIA = {
  'Cámaras': [
    { titulo: 'Cámara Canon AE-1 35 mm', jpy: 27800, tipoVenta: 'fijo', stock: 3 },
    { titulo: 'Cámara Fujifilm Instax Mini 12', jpy: 12500, tipoVenta: 'fijo', stock: 8 },
    { titulo: 'Cámara Nikon FM2 cuerpo', jpy: 34900, tipoVenta: 'subasta', stock: 1 },
  ],
  'Lentes y accesorios': [
    { titulo: 'Lente Nikkor 50 mm f/1.4', jpy: 13490, tipoVenta: 'fijo', stock: 5 },
    { titulo: 'Flash Speedlite 430EX', jpy: 6890, tipoVenta: 'fijo', stock: 6 },
    { titulo: 'Lente Canon 24-70 mm f/2.8', jpy: 89000, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Bolso fotográfico de cuero', jpy: 4880, tipoVenta: 'fijo', stock: 10 },
  ],
  'Electrónica': [
    { titulo: 'iPhone 12 reacondicionado 128GB', jpy: 62000, tipoVenta: 'fijo', stock: 4 },
    { titulo: 'Auriculares Sony WH-1000XM4', jpy: 21000, tipoVenta: 'fijo', stock: 7 },
    { titulo: 'Consola Famicom original (1985)', jpy: 45000, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Teclado mecánico HHKB', jpy: 28900, tipoVenta: 'fijo', stock: 5 },
    { titulo: 'Batería portátil Anker 20000mAh', jpy: 5400, tipoVenta: 'fijo', stock: 15 },
  ],
  'Relojería': [
    { titulo: 'Reloj Seiko 5 automático', jpy: 14650, tipoVenta: 'fijo', stock: 6 },
    { titulo: 'Casio G-Shock GA-2100', jpy: 9800, tipoVenta: 'fijo', stock: 9 },
    { titulo: 'Citizen Eco-Drive vintage', jpy: 22000, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Orient Bambino versión 2', jpy: 16500, tipoVenta: 'fijo', stock: 4 },
  ],
  'Coleccionables': [
    { titulo: 'Figura coleccionable vintage Ultraman', jpy: 8350, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Lote de cartas Pokémon TCG (japonés)', jpy: 15200, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Manga One Piece primera edición vol.1', jpy: 6200, tipoVenta: 'fijo', stock: 3 },
    { titulo: 'Cel de animación enmarcado (Ghibli)', jpy: 32000, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Gunpla RX-78-2 escala 1/100', jpy: 7100, tipoVenta: 'fijo', stock: 12 },
  ],
  'Instrumentos': [
    { titulo: 'Guitarra acústica Yamaha FG800', jpy: 24500, tipoVenta: 'fijo', stock: 4 },
    { titulo: 'Teclado Casio CT-S300', jpy: 18700, tipoVenta: 'fijo', stock: 5 },
    { titulo: 'Bajo eléctrico usado Fender Jazz', jpy: 58000, tipoVenta: 'subasta', stock: 1 },
    { titulo: 'Ukulele soprano de caoba', jpy: 5600, tipoVenta: 'fijo', stock: 8 },
  ],
};

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

function idExterno() {
  return `YA-${Math.floor(100000 + Math.random() * 900000)}`;
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

    // Categorías (con una subcategoría para probar el árbol de /categorias)
    const idPorCategoria = {};
    for (const cat of CATEGORIAS) {
      const { rows } = await client.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [cat.nombre]);
      idPorCategoria[cat.nombre] = rows[0].id;
      for (const hijo of cat.hijos || []) {
        const { rows: hijoRows } = await client.query(
          'INSERT INTO categorias (nombre, id_padre) VALUES ($1, $2) RETURNING id',
          [hijo, rows[0].id]
        );
        idPorCategoria[hijo] = hijoRows[0].id;
      }
    }

    // Tipo de cambio vigente (ver wireframe W06: JPY/USD 152.40, margen 3%)
    await client.query(
      `INSERT INTO tipo_cambio (moneda_origen, moneda_destino, tasa, margen) VALUES ('JPY','USD',152.40,0.03)`
    );

    // Productos
    const productosPorCategoria = {}; // nombreCategoria -> [ids de producto]
    for (const [nombreCat, lista] of Object.entries(PRODUCTOS_POR_CATEGORIA)) {
      productosPorCategoria[nombreCat] = [];
      for (const p of lista) {
        const precioUsd = tasaAUsd(p.jpy);
        const fechaFinSubasta = p.tipoVenta === 'subasta'
          ? new Date(Date.now() + (2 + Math.random() * 96) * 3600 * 1000) // 2h a 4 días
          : null;
        const { rows } = await client.query(
          `INSERT INTO productos (id_externo_ya, id_categoria, titulo, descripcion, precio_jpy, precio_usd, tipo_venta, fecha_fin_subasta, stock)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [idExterno(), idPorCategoria[nombreCat], p.titulo, `${p.titulo} — importado vía YAuctions Japón.`, p.jpy, precioUsd, p.tipoVenta, fechaFinSubasta, p.stock]
        );
        // Placeholder local (SVG data-URI): no depende de red externa. En
        // producción esto sería la URL real del objeto de imagen (Amazon S3 / CDN),
        // ver supuestos_fase3.md #12.
        const inicial = encodeURIComponent(p.titulo[0]);
        const svg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='100%25' height='100%25' fill='%23e8e8e8'/><text x='50%25' y='50%25' font-size='120' text-anchor='middle' dominant-baseline='middle' fill='%23999' font-family='sans-serif'>${inicial}</text></svg>`;
        await client.query(
          `INSERT INTO producto_imagenes (id_producto, url_blob, orden) VALUES ($1,$2,0)`,
          [rows[0].id, svg]
        );
        productosPorCategoria[nombreCat].push(rows[0].id);
      }
    }
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
    const { rows: subastas } = await client.query("SELECT id FROM productos WHERE tipo_venta = 'subasta' LIMIT 4");
    const estadosDemo = ['aceptada', 'aceptada', 'rechazada', 'superada'];
    for (let idx = 0; idx < subastas.length; idx++) {
      const pedidoDePuja = await client.query(
        `INSERT INTO pedidos (codigo, id_usuario, id_direccion, estado, subtotal_usd, flete_usd, comision_usd, total_usd)
         VALUES ($1,$2,$3,'en_proceso',0,0,0,0) RETURNING id`,
        [`CL-${new Date().getFullYear()}-${String(9000 + idx).padStart(4, '0')}`, laura, dirLaura[0].id]
      );
      await client.query(
        `INSERT INTO pujas (id_pedido, id_producto, monto_jpy, estado) VALUES ($1,$2,$3,$4)`,
        [pedidoDePuja.rows[0].id, subastas[idx].id, 10000 + idx * 500, estadosDemo[idx]]
      );
    }

    console.log(`Listo: ${CATEGORIAS.length} categorías (+subcategoría), ${todosLosProductos.length} productos, ${USUARIOS_DEMO.length} usuarios demo + 1 admin.`);
    console.log('Login admin: admin@compralatino.com / Admin1234!');
    console.log('Login demo:  laura.pineda@demo.compralatino.com / Demo1234!  (y los otros 4 usuarios listados en db/seed.js)');
  });

  await pool.end();
}

main().catch((err) => {
  console.error('Error sembrando datos:', err);
  process.exit(1);
});
