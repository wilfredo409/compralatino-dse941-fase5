-- Carga coherente del almacén. Ejecutar con psql -v ON_ERROR_STOP=1.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(94105);
CALL dw.sp_cargar_dim_cliente();
CALL dw.sp_cargar_dim_producto();
CALL dw.sp_cargar_fact_ventas();
CALL dw.sp_cargar_fact_integracion();
CALL dw.sp_cargar_fact_recomendaciones();
COMMIT;
