\set ON_ERROR_STOP on
DO $$
DECLARE
    discrepancias INT;
BEGIN
    SELECT count(*) INTO discrepancias
    FROM (
        SELECT p.id
        FROM public.pedidos p
        LEFT JOIN dw.fact_ventas v ON v.id_pedido_origen = p.id
        WHERE p.estado <> 'creado'
          AND EXISTS (SELECT 1 FROM public.pedido_detalle d WHERE d.id_pedido = p.id)
        GROUP BY p.id
        HAVING SUM(v.subtotal_usd) IS DISTINCT FROM p.subtotal_usd
            OR SUM(v.flete_usd) IS DISTINCT FROM p.flete_usd
            OR SUM(v.comision_usd) IS DISTINCT FROM p.comision_usd
            OR SUM(v.total_usd) IS DISTINCT FROM p.total_usd
    ) AS pedidos_con_diferencias;
    IF discrepancias > 0 THEN
        RAISE EXCEPTION 'Importes del almacén difieren de % cabeceras', discrepancias;
    END IF;
END;
$$;

SELECT
  (SELECT count(*) FROM dw.dim_cliente) AS clientes,
  (SELECT count(*) FROM dw.dim_producto) AS productos,
  (SELECT count(*) FROM dw.fact_ventas) AS ventas,
  (SELECT count(*) FROM dw.fact_integracion_yauctions) AS pujas,
  (SELECT count(*) FROM dw.fact_recomendaciones) AS recomendaciones,
  (SELECT count(*) FROM dw.etl_log WHERE estado = 'EXITOSO') AS etapas_exitosas;
