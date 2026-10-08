-- ============================================================
-- CompraLatino - Fase 3 - Anexo H.2
-- Procedimientos del proceso ETL (incremental, con UPSERT)
-- ============================================================
 
-- Carga unica del calendario (ejecutar una sola vez)
INSERT INTO dw.dim_tiempo
    (id_tiempo, fecha, anio, trimestre, mes, nombre_mes, dia, dia_semana, nombre_dia, es_fin_de_semana)
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INT,
    d::DATE,
    EXTRACT(YEAR FROM d)::SMALLINT,
    EXTRACT(QUARTER FROM d)::SMALLINT,
    EXTRACT(MONTH FROM d)::SMALLINT,
    TO_CHAR(d, 'TMMonth'),
    EXTRACT(DAY FROM d)::SMALLINT,
    EXTRACT(ISODOW FROM d)::SMALLINT,
    TO_CHAR(d, 'TMDay'),
    EXTRACT(ISODOW FROM d) IN (6, 7)
FROM generate_series('2025-01-01'::DATE, '2029-12-31'::DATE, INTERVAL '1 day') AS d
ON CONFLICT (id_tiempo) DO NOTHING;
 
-- ---------- dim_cliente ----------
CREATE OR REPLACE PROCEDURE dw.sp_cargar_dim_cliente()
LANGUAGE plpgsql AS $$
DECLARE
    v_filas INT;
BEGIN
    INSERT INTO dw.dim_cliente
        (id_usuario, nombre_completo, pais, departamento, ciudad, segmento, fecha_registro)
    SELECT
        u.id,
        u.nombre || ' ' || u.apellido,
        d.pais, d.departamento, d.ciudad,
        CASE WHEN (
            SELECT COUNT(*) FROM public.pedidos p
            WHERE p.id_usuario = u.id AND p.estado <> 'cancelado'
        ) > 1 THEN 'RECURRENTE' ELSE 'NUEVO' END,
        u.fecha_registro::DATE
    FROM public.usuarios u
    LEFT JOIN LATERAL (
        SELECT pais, departamento, ciudad FROM public.direcciones
        WHERE id_usuario = u.id ORDER BY es_principal DESC LIMIT 1
    ) d ON TRUE
    ON CONFLICT (id_usuario) DO UPDATE SET
        nombre_completo = EXCLUDED.nombre_completo,
        pais = EXCLUDED.pais, departamento = EXCLUDED.departamento, ciudad = EXCLUDED.ciudad,
        segmento = EXCLUDED.segmento,
        fecha_actualizacion_dw = now();
 
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    INSERT INTO dw.etl_log (proceso, fecha_fin, filas_procesadas, estado)
    VALUES ('dim_cliente', now(), v_filas, 'EXITOSO');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO dw.etl_log (proceso, fecha_fin, estado, detalle_error)
    VALUES ('dim_cliente', now(), 'FALLIDO', SQLERRM);
    RAISE;
END;
$$;
 
-- ---------- dim_producto ----------
CREATE OR REPLACE PROCEDURE dw.sp_cargar_dim_producto()
LANGUAGE plpgsql AS $$
DECLARE
    v_filas INT;
BEGIN
    INSERT INTO dw.dim_producto
        (id_producto, titulo, categoria, categoria_padre, tipo_venta, rango_precio_usd, vigente)
    SELECT
        p.id, p.titulo, c.nombre, cp.nombre, p.tipo_venta,
        CASE
            WHEN COALESCE(p.precio_usd, 0) < 25  THEN '0-25'
            WHEN p.precio_usd < 50                THEN '25-50'
            WHEN p.precio_usd < 100               THEN '50-100'
            WHEN p.precio_usd < 250               THEN '100-250'
            ELSE '250+'
        END,
        p.stock > 0
    FROM public.productos p
    LEFT JOIN public.categorias c  ON c.id = p.id_categoria
    LEFT JOIN public.categorias cp ON cp.id = c.id_padre
    ON CONFLICT (id_producto) DO UPDATE SET
        titulo = EXCLUDED.titulo, categoria = EXCLUDED.categoria,
        categoria_padre = EXCLUDED.categoria_padre, tipo_venta = EXCLUDED.tipo_venta,
        rango_precio_usd = EXCLUDED.rango_precio_usd, vigente = EXCLUDED.vigente,
        fecha_actualizacion_dw = now();
 
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    INSERT INTO dw.etl_log (proceso, fecha_fin, filas_procesadas, estado)
    VALUES ('dim_producto', now(), v_filas, 'EXITOSO');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO dw.etl_log (proceso, fecha_fin, estado, detalle_error)
    VALUES ('dim_producto', now(), 'FALLIDO', SQLERRM);
    RAISE;
END;
$$;
 
-- ---------- fact_ventas (incremental por marca de agua) ----------
-- Los estados de public.pedidos (minusculas, 6 valores del esquema) se
-- traducen al catalogo de 9 estados de dw.dim_estado_pedido (Figura 11).
-- Subtotal, flete y comision del pedido se prorratean entre sus lineas
-- segun el subtotal de cada linea, para que SUM(total_usd) no duplique pedidos.
CREATE OR REPLACE PROCEDURE dw.sp_cargar_fact_ventas(IN p_desde TIMESTAMPTZ DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_desde TIMESTAMPTZ := COALESCE(
        p_desde,
        (SELECT MAX(fecha_fin) - INTERVAL '2 hours' FROM dw.etl_log
         WHERE proceso = 'fact_ventas' AND estado = 'EXITOSO'),
        '2000-01-01'
    );
    v_filas INT;
BEGIN
    INSERT INTO dw.fact_ventas
        (id_tiempo, id_cliente_dw, id_producto_dw, id_estado, id_dispositivo,
         id_pedido_origen, cantidad, precio_unitario_usd, subtotal_usd, flete_usd,
         comision_usd, total_usd)
    SELECT
        TO_CHAR(pe.fecha_creacion, 'YYYYMMDD')::INT,
        dc.id_cliente_dw, dp.id_producto_dw, de.id_estado,
        (SELECT id_dispositivo FROM dw.dim_dispositivo WHERE tipo = 'DESCONOCIDO'),
        pe.id, dt.cantidad, dt.precio_unitario_usd,
        l.subtotal,
        ROUND(pe.flete_usd    * l.subtotal / NULLIF(pe.subtotal_usd, 0), 2),
        ROUND(pe.comision_usd * l.subtotal / NULLIF(pe.subtotal_usd, 0), 2),
        l.subtotal
          + ROUND(pe.flete_usd    * l.subtotal / NULLIF(pe.subtotal_usd, 0), 2)
          + ROUND(pe.comision_usd * l.subtotal / NULLIF(pe.subtotal_usd, 0), 2)
    FROM public.pedidos pe
    JOIN public.pedido_detalle dt  ON dt.id_pedido = pe.id
    CROSS JOIN LATERAL (SELECT dt.cantidad * dt.precio_unitario_usd AS subtotal) l
    JOIN dw.dim_cliente dc         ON dc.id_usuario = pe.id_usuario
    JOIN dw.dim_producto dp        ON dp.id_producto = dt.id_producto
    JOIN dw.dim_estado_pedido de   ON de.nombre_estado = CASE pe.estado
                                        WHEN 'creado'     THEN 'CREADO'
                                        WHEN 'pagado'     THEN 'PAGADO'
                                        WHEN 'en_proceso' THEN 'EN_COMPRA_YA'
                                        WHEN 'enviado'    THEN 'EN_TRANSITO'
                                        WHEN 'entregado'  THEN 'ENTREGADO'
                                        WHEN 'cancelado'  THEN 'CANCELADO'
                                      END
    WHERE pe.fecha_creacion > v_desde
      AND pe.estado <> 'creado'
    ON CONFLICT (id_pedido_origen, id_producto_dw) DO UPDATE SET
        id_estado = EXCLUDED.id_estado, total_usd = EXCLUDED.total_usd;
 
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    INSERT INTO dw.etl_log (proceso, fecha_fin, filas_procesadas, estado)
    VALUES ('fact_ventas', now(), v_filas, 'EXITOSO');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO dw.etl_log (proceso, fecha_fin, estado, detalle_error)
    VALUES ('fact_ventas', now(), 'FALLIDO', SQLERRM);
    RAISE;
END;
$$;
 
-- ---------- fact_integracion_yauctions ----------
-- Solo se cargan las pujas, que el backend de la Fase 3 persiste en
-- public.pujas (respuesta_ya contiene latenciaMs). El estado del circuito
-- y los reintentos se leen si el backend los registra; de lo contrario
-- se asume CERRADO y 0.
CREATE OR REPLACE PROCEDURE dw.sp_cargar_fact_integracion()
LANGUAGE plpgsql AS $$
DECLARE
    v_filas INT;
BEGIN
    INSERT INTO dw.fact_integracion_yauctions
        (id_tiempo, id_producto_dw, tipo_operacion, resultado, circuito_estado,
         cantidad_reintentos, latencia_ms, fecha_hora)
    SELECT
        TO_CHAR(pu.fecha_envio, 'YYYYMMDD')::INT,
        dp.id_producto_dw,
        'PUJA',
        CASE pu.estado WHEN 'rechazada' THEN 'FALLIDA' ELSE 'EXITOSA' END,
        COALESCE(pu.respuesta_ya ->> 'circuito', 'CERRADO'),
        COALESCE((pu.respuesta_ya ->> 'reintentos')::SMALLINT, 0),
        COALESCE(pu.respuesta_ya ->> 'latenciaMs', pu.respuesta_ya ->> 'latencia_ms')::NUMERIC::INT,
        pu.fecha_envio
    FROM public.pujas pu
    JOIN dw.dim_producto dp ON dp.id_producto = pu.id_producto
    WHERE pu.fecha_envio > COALESCE(
        (SELECT MAX(fecha_hora) FROM dw.fact_integracion_yauctions), '2000-01-01'
    );
 
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    INSERT INTO dw.etl_log (proceso, fecha_fin, filas_procesadas, estado)
    VALUES ('fact_integracion', now(), v_filas, 'EXITOSO');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO dw.etl_log (proceso, fecha_fin, estado, detalle_error)
    VALUES ('fact_integracion', now(), 'FALLIDO', SQLERRM);
    RAISE;
END;
$$;
 
-- ---------- fact_recomendaciones ----------
CREATE OR REPLACE PROCEDURE dw.sp_cargar_fact_recomendaciones()
LANGUAGE plpgsql AS $$
DECLARE
    v_filas INT;
BEGIN
    INSERT INTO dw.fact_recomendaciones
        (id_tiempo, id_cliente_dw, id_producto_dw, puntaje, fue_clic, fue_compra)
    SELECT
        TO_CHAR(r.fecha_generacion, 'YYYYMMDD')::INT,
        dc.id_cliente_dw, dp.id_producto_dw, r.puntaje,
        EXISTS (
            SELECT 1 FROM public.historial_navegacion h
            WHERE h.id_usuario = r.id_usuario AND h.id_producto = r.id_producto
              AND h.fecha_visita > r.fecha_generacion
        ),
        EXISTS (
            SELECT 1 FROM public.pedido_detalle dt
            JOIN public.pedidos pe ON pe.id = dt.id_pedido
            WHERE pe.id_usuario = r.id_usuario AND dt.id_producto = r.id_producto
              AND pe.fecha_creacion > r.fecha_generacion
              AND pe.fecha_creacion < r.fecha_generacion + INTERVAL '7 days'
        )
    FROM public.recomendaciones r
    JOIN dw.dim_cliente dc  ON dc.id_usuario = r.id_usuario
    JOIN dw.dim_producto dp ON dp.id_producto = r.id_producto
    WHERE r.fecha_generacion > COALESCE(
        (SELECT MAX(fecha_fin) FROM dw.etl_log
         WHERE proceso = 'fact_recomendaciones' AND estado = 'EXITOSO'),
        '2000-01-01'
    );
 
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    INSERT INTO dw.etl_log (proceso, fecha_fin, filas_procesadas, estado)
    VALUES ('fact_recomendaciones', now(), v_filas, 'EXITOSO');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO dw.etl_log (proceso, fecha_fin, estado, detalle_error)
    VALUES ('fact_recomendaciones', now(), 'FALLIDO', SQLERRM);
    RAISE;
END;
$$;
