-- ============================================================
-- CompraLatino - Fase 3 - Anexo H.3
-- Orquestacion nocturna de la corrida ETL completa (Amazon RDS)
-- ============================================================
-- Requisitos en Amazon RDS for PostgreSQL: agregar pg_cron a
-- shared_preload_libraries en el grupo de parametros, reiniciar la
-- instancia y ejecutar lo siguiente conectado a la base "postgres"
-- como miembro de rds_superuser (Amazon Web Services, 2026c).
CREATE EXTENSION IF NOT EXISTS pg_cron;
 
SELECT cron.schedule(
    'etl_compralatino_nightly',
    '0 2 * * *',          -- 02:00 UTC, fuera del horario pico de LatAm
    $$
    CALL dw.sp_cargar_dim_cliente();
    CALL dw.sp_cargar_dim_producto();
    CALL dw.sp_cargar_fact_ventas();
    CALL dw.sp_cargar_fact_integracion();
    CALL dw.sp_cargar_fact_recomendaciones();
    $$
);
 
-- pg_cron guarda sus metadatos en la base "postgres"; para que el trabajo
-- se ejecute sobre la base de la aplicacion se actualiza su columna database.
UPDATE cron.job SET database = 'compralatino_db'
WHERE jobname = 'etl_compralatino_nightly';
 
-- Consulta de verificacion (en compralatino_db): ultimas 5 corridas
SELECT proceso, fecha_inicio, fecha_fin, filas_procesadas, estado
FROM dw.etl_log
ORDER BY fecha_inicio DESC
LIMIT 5;
