import { productosDemo } from './productos-demo.js';

const PADRES = { 'Lentes y accesorios': 'Cámaras' };
const TASA_DEMO = 152.4;
const MARGEN_DEMO = 0.03;

async function categoriaDemo(client, nombre, ids) {
  if (ids.has(nombre)) return ids.get(nombre);
  const padre = PADRES[nombre] ? await categoriaDemo(client, PADRES[nombre], ids) : null;
  const { rows } = await client.query(
    'SELECT id FROM categorias WHERE nombre = $1 AND id_padre IS NOT DISTINCT FROM $2 ORDER BY id LIMIT 1',
    [nombre, padre]
  );
  const id = rows[0]?.id ?? (await client.query(
    'INSERT INTO categorias (nombre, id_padre) VALUES ($1, $2) RETURNING id',
    [nombre, padre]
  )).rows[0].id;
  ids.set(nombre, id);
  return id;
}

export async function cargarCatalogoDemo(client) {
  await client.query('SELECT pg_advisory_xact_lock(94106)');
  const idsCategorias = new Map();
  const porCategoria = {};

  for (const item of productosDemo) {
    const { slug, categoria, titulo, jpy, tipoVenta, stock, resumen, descripcion } = item;
    const referencia = `DEMO-JP-${slug}`;
    const texto = `${resumen}\n\n${descripcion}`;
    const cierre = tipoVenta === 'subasta' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
    const idCategoria = await categoriaDemo(client, categoria, idsCategorias);
    const anterior = await client.query(
      `SELECT id, id_externo_ya FROM productos
       WHERE id_externo_ya = $1 OR (titulo = $2 AND descripcion = $3 AND id_externo_ya LIKE 'YA-%')
       ORDER BY (id_externo_ya = $1) DESC LIMIT 1`,
      [referencia, titulo, `${titulo} — importado vía YAuctions Japón.`]
    );

    let id = anterior.rows[0]?.id;
    if (id) {
      await client.query(
        `UPDATE productos SET id_externo_ya = $1, descripcion = $2,
         fecha_fin_subasta = CASE
           WHEN id_externo_ya LIKE 'YA-%' AND tipo_venta = 'subasta' THEN GREATEST(fecha_fin_subasta, $3::timestamptz)
           ELSE fecha_fin_subasta END
         WHERE id = $4`,
        [referencia, texto, cierre, id]
      );
      await client.query(
        "DELETE FROM producto_imagenes WHERE id_producto = $1 AND url_blob LIKE 'data:image/svg+xml%'",
        [id]
      );
    } else {
      const usd = Math.round((jpy / TASA_DEMO) * (1 + MARGEN_DEMO) * 100) / 100;
      const { rows } = await client.query(
        `INSERT INTO productos
           (id_externo_ya, id_categoria, titulo, descripcion, precio_jpy, precio_usd, tipo_venta, fecha_fin_subasta, stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [referencia, idCategoria, titulo, texto, jpy, usd, tipoVenta, cierre, stock]
      );
      id = rows[0].id;
    }

    const foto = `/catalogo/${slug}.webp`;
    await client.query(
      `INSERT INTO producto_imagenes (id_producto, url_blob, orden)
       SELECT $1::uuid, $2::varchar, 0
       WHERE NOT EXISTS (SELECT 1 FROM producto_imagenes WHERE id_producto = $1 AND url_blob = $2)`,
      [id, foto]
    );
    (porCategoria[categoria] ||= []).push(id);
  }
  return porCategoria;
}
