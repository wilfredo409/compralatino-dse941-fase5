import { query } from '../config/db.js';

export async function obtenerPeriodosEjecutivos(dias) {
  const { rows } = await query(
    `WITH limites AS (
       SELECT now() - $1::int * interval '1 day' AS actual,
              now() - $1::int * interval '2 days' AS anterior
     ), periodos AS (
       SELECT 'actual' AS periodo, actual AS inicio, now() AS fin FROM limites
       UNION ALL
       SELECT 'anterior', anterior, actual FROM limites
     )
     SELECT periodo,
            ventas.usd, ventas.pedidos, ventas.clientes,
            ventas.recurrentes, ventas.entregados
     FROM periodos
     CROSS JOIN LATERAL (
       SELECT COALESCE(SUM(importe), 0) AS usd, COALESCE(SUM(pedidos), 0)::int AS pedidos,
              COUNT(*)::int AS clientes, COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM pedidos h
                  WHERE h.id_usuario = compras.id_usuario AND h.fecha_creacion < periodos.inicio
                    AND h.estado IN ('pagado', 'en_proceso', 'enviado', 'entregado')
                )
              )::int AS recurrentes,
              COALESCE(SUM(entregados), 0)::int AS entregados
       FROM (
         SELECT id_usuario, SUM(total_usd) AS importe, COUNT(*) AS pedidos,
                COUNT(*) FILTER (WHERE estado = 'entregado') AS entregados
         FROM pedidos
         WHERE fecha_creacion >= periodos.inicio AND fecha_creacion < periodos.fin
           AND estado IN ('pagado', 'en_proceso', 'enviado', 'entregado')
         GROUP BY id_usuario
       ) AS compras
     ) AS ventas`,
    [dias]
  );
  return Object.fromEntries(rows.map(({ periodo, ...datos }) => [periodo, datos]));
}
