import { query, withTransaction } from '../config/db.js';

/**
 * Motor de recomendaciones (M4) — regla de negocio documentada en
 * supuestos_fase3.md #1 (decisión pendiente del equipo, asumida aquí):
 *
 *   1. Se identifican las categorías de los productos que el usuario ya
 *      compró (pedido_detalle → productos.id_categoria), ordenadas por
 *      frecuencia de compra.
 *   2. Se recomiendan productos de esas categorías que el usuario NO ha
 *      comprado todavía, ordenados por popularidad global (veces que
 *      aparecen en pedido_detalle de cualquier usuario) como proxy de
 *      "más comprados".
 *   3. Si el usuario no tiene historial de compras, se usa su historial de
 *      navegación (historial_navegacion) con el mismo criterio de categoría.
 *   4. Si tampoco hay navegación registrada, se recomiendan los productos
 *      globalmente más populares (catálogo "en tendencia").
 *
 * Cada fila generada guarda su `motivo` en texto para que quede trazable
 * por qué se recomendó cada producto (columna `recomendaciones.motivo`).
 */

const LIMITE_RECOMENDACIONES = 10;

async function categoriasPorCompra(idUsuario) {
  const { rows } = await query(
    `SELECT p.id_categoria, COUNT(*) AS frecuencia
     FROM pedido_detalle pd
     JOIN pedidos ped ON ped.id = pd.id_pedido
     JOIN productos p ON p.id = pd.id_producto
     WHERE ped.id_usuario = $1
     GROUP BY p.id_categoria
     ORDER BY frecuencia DESC`,
    [idUsuario]
  );
  return rows.map((r) => r.id_categoria);
}

async function categoriasPorNavegacion(idUsuario) {
  const { rows } = await query(
    `SELECT p.id_categoria, COUNT(*) AS frecuencia
     FROM historial_navegacion h
     JOIN productos p ON p.id = h.id_producto
     WHERE h.id_usuario = $1
     GROUP BY p.id_categoria
     ORDER BY frecuencia DESC`,
    [idUsuario]
  );
  return rows.map((r) => r.id_categoria);
}

async function productosPopularesPorCategoria(categorias, excluirIds, limite) {
  if (categorias.length === 0) return [];
  const { rows } = await query(
    `SELECT p.id, p.id_categoria, COUNT(pd.id) AS ventas
     FROM productos p
     LEFT JOIN pedido_detalle pd ON pd.id_producto = p.id
     WHERE p.id_categoria = ANY($1::int[]) AND NOT (p.id = ANY($2::uuid[]))
     GROUP BY p.id, p.id_categoria
     ORDER BY ventas DESC, p.fecha_sincronizacion DESC
     LIMIT $3`,
    [categorias, excluirIds.length ? excluirIds : ['00000000-0000-0000-0000-000000000000'], limite]
  );
  return rows;
}

async function productosMasPopularesGlobal(excluirIds, limite) {
  const { rows } = await query(
    `SELECT p.id, p.id_categoria, COUNT(pd.id) AS ventas
     FROM productos p
     LEFT JOIN pedido_detalle pd ON pd.id_producto = p.id
     WHERE NOT (p.id = ANY($1::uuid[]))
     GROUP BY p.id, p.id_categoria
     ORDER BY ventas DESC, p.fecha_sincronizacion DESC
     LIMIT $2`,
    [excluirIds.length ? excluirIds : ['00000000-0000-0000-0000-000000000000'], limite]
  );
  return rows;
}

/** Recalcula y persiste las recomendaciones vigentes del usuario; devuelve las filas. */
export async function recalcularRecomendaciones(idUsuario) {
  const { rows: comprados } = await query(
    `SELECT DISTINCT pd.id_producto
     FROM pedido_detalle pd JOIN pedidos p ON p.id = pd.id_pedido
     WHERE p.id_usuario = $1`,
    [idUsuario]
  );
  const idsComprados = comprados.map((r) => r.id_producto);

  let candidatos = [];
  let motivoBase = '';

  const categoriasCompra = await categoriasPorCompra(idUsuario);
  if (categoriasCompra.length > 0) {
    candidatos = await productosPopularesPorCategoria(categoriasCompra, idsComprados, LIMITE_RECOMENDACIONES);
    motivoBase = 'Popular en una categoría que ya compraste';
  }

  if (candidatos.length === 0) {
    const categoriasNav = await categoriasPorNavegacion(idUsuario);
    if (categoriasNav.length > 0) {
      candidatos = await productosPopularesPorCategoria(categoriasNav, idsComprados, LIMITE_RECOMENDACIONES);
      motivoBase = 'Popular en una categoría que visitaste';
    }
  }

  if (candidatos.length === 0) {
    candidatos = await productosMasPopularesGlobal(idsComprados, LIMITE_RECOMENDACIONES);
    motivoBase = 'Tendencia general del catálogo (sin historial suficiente)';
  }

  const maxVentas = Math.max(1, ...candidatos.map((c) => Number(c.ventas) || 0));

  return withTransaction(async (client) => {
    await client.query('DELETE FROM recomendaciones WHERE id_usuario = $1', [idUsuario]);
    const insertadas = [];
    for (const c of candidatos) {
      const puntaje = Math.min(0.99, 0.5 + (Number(c.ventas) || 0) / (maxVentas * 2));
      const { rows } = await client.query(
        `INSERT INTO recomendaciones (id_usuario, id_producto, puntaje, motivo)
         VALUES ($1, $2, $3, $4) RETURNING id_producto, puntaje, motivo, fecha_generacion`,
        [idUsuario, c.id, puntaje.toFixed(4), motivoBase]
      );
      insertadas.push(rows[0]);
    }
    return insertadas;
  });
}
