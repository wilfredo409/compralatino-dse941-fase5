-- ============================================================
-- CompraLatino - Fase 3 - Anexo H.1
-- DDL del esquema de almacen de datos (dw)
-- Motor: PostgreSQL 16 (Amazon RDS for PostgreSQL)
-- Ejecucion: psql -v bi_reader_password='<clave>' -f F1.sql
-- ============================================================
CREATE SCHEMA IF NOT EXISTS dw;
 
-- ---------- Dimension: tiempo ----------
CREATE TABLE dw.dim_tiempo (
    id_tiempo         INT PRIMARY KEY,         -- formato AAAAMMDD
    fecha             DATE NOT NULL UNIQUE,
    anio              SMALLINT NOT NULL,
    trimestre         SMALLINT NOT NULL,
    mes               SMALLINT NOT NULL,
    nombre_mes        VARCHAR(20) NOT NULL,
    dia               SMALLINT NOT NULL,
    dia_semana        SMALLINT NOT NULL,       -- 1=lunes ... 7=domingo (ISO)
    nombre_dia        VARCHAR(20) NOT NULL,
    es_fin_de_semana  BOOLEAN NOT NULL
);
 
-- ---------- Dimension: cliente (SCD tipo 1) ----------
CREATE TABLE dw.dim_cliente (
    id_cliente_dw     BIGSERIAL PRIMARY KEY,
    id_usuario        UUID NOT NULL UNIQUE,    -- clave natural: usuarios.id (OLTP)
    nombre_completo   VARCHAR(161) NOT NULL,
    pais              VARCHAR(60),
    departamento      VARCHAR(60),
    ciudad            VARCHAR(60),
    segmento          VARCHAR(20) NOT NULL DEFAULT 'NUEVO',  -- NUEVO | RECURRENTE
    fecha_registro    DATE NOT NULL,
    fecha_actualizacion_dw TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
-- ---------- Dimension: producto ----------
CREATE TABLE dw.dim_producto (
    id_producto_dw      BIGSERIAL PRIMARY KEY,
    id_producto          UUID NOT NULL UNIQUE,  -- clave natural: productos.id (OLTP)
    titulo                VARCHAR(200) NOT NULL,
    categoria             VARCHAR(80),
    categoria_padre       VARCHAR(80),
    tipo_venta            VARCHAR(20),
    rango_precio_usd      VARCHAR(20),          -- '0-25'|'25-50'|'50-100'|'100-250'|'250+'
    vigente               BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_actualizacion_dw TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
-- ---------- Dimension: estado del pedido ----------
CREATE TABLE dw.dim_estado_pedido (
    id_estado         SERIAL PRIMARY KEY,
    nombre_estado     VARCHAR(25) NOT NULL UNIQUE,
    etapa             VARCHAR(20) NOT NULL,     -- PRE_PAGO|POST_PAGO|LOGISTICA|FINAL
    es_estado_final   BOOLEAN NOT NULL
);
 
INSERT INTO dw.dim_estado_pedido (nombre_estado, etapa, es_estado_final) VALUES
    ('CREADO',             'PRE_PAGO',  FALSE),
    ('PENDIENTE_PAGO',     'PRE_PAGO',  FALSE),
    ('PAGADO',             'POST_PAGO', FALSE),
    ('EN_COMPRA_YA',       'POST_PAGO', FALSE),
    ('ADQUIRIDO',          'LOGISTICA', FALSE),
    ('EN_TRANSITO',        'LOGISTICA', FALSE),
    ('ENTREGADO',          'FINAL',     TRUE),
    ('CANCELADO',          'FINAL',     TRUE),
    ('REEMBOLSADO',        'FINAL',     TRUE)
ON CONFLICT (nombre_estado) DO NOTHING;
 
-- ---------- Dimension: dispositivo ----------
CREATE TABLE dw.dim_dispositivo (
    id_dispositivo    SERIAL PRIMARY KEY,
    tipo              VARCHAR(20) NOT NULL UNIQUE
);
INSERT INTO dw.dim_dispositivo (tipo) VALUES
    ('ESCRITORIO'), ('TABLET'), ('SMARTPHONE'), ('DESCONOCIDO')
ON CONFLICT (tipo) DO NOTHING;
 
-- ---------- Hechos: ventas ----------
CREATE TABLE dw.fact_ventas (
    id_fact_venta        BIGSERIAL PRIMARY KEY,
    id_tiempo            INT NOT NULL REFERENCES dw.dim_tiempo(id_tiempo),
    id_cliente_dw        BIGINT NOT NULL REFERENCES dw.dim_cliente(id_cliente_dw),
    id_producto_dw       BIGINT NOT NULL REFERENCES dw.dim_producto(id_producto_dw),
    id_estado            INT NOT NULL REFERENCES dw.dim_estado_pedido(id_estado),
    id_dispositivo       INT REFERENCES dw.dim_dispositivo(id_dispositivo),
    id_pedido_origen     UUID NOT NULL,          -- clave natural: pedidos.id (OLTP)
    cantidad             INT NOT NULL,
    precio_unitario_usd  NUMERIC(12,2) NOT NULL,
    subtotal_usd         NUMERIC(12,2) NOT NULL,
    flete_usd            NUMERIC(12,2) NOT NULL DEFAULT 0,
    comision_usd         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_usd            NUMERIC(12,2) NOT NULL,
    UNIQUE (id_pedido_origen, id_producto_dw)
);
CREATE INDEX idx_fact_ventas_tiempo    ON dw.fact_ventas(id_tiempo);
CREATE INDEX idx_fact_ventas_cliente   ON dw.fact_ventas(id_cliente_dw);
CREATE INDEX idx_fact_ventas_producto  ON dw.fact_ventas(id_producto_dw);
 
-- ---------- Hechos: integracion con YAuctions ----------
CREATE TABLE dw.fact_integracion_yauctions (
    id_fact_integracion   BIGSERIAL PRIMARY KEY,
    id_tiempo             INT NOT NULL REFERENCES dw.dim_tiempo(id_tiempo),
    id_producto_dw        BIGINT REFERENCES dw.dim_producto(id_producto_dw),
    tipo_operacion         VARCHAR(20) NOT NULL,  -- PUJA | COMPRA_DIRECTA
    resultado              VARCHAR(20) NOT NULL,  -- EXITOSA | FALLIDA | TIMEOUT
    circuito_estado        VARCHAR(15) NOT NULL,  -- CERRADO | ABIERTO | SEMIABIERTO
    cantidad_reintentos    SMALLINT NOT NULL DEFAULT 0,
    latencia_ms            INT,
    fecha_hora             TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_fact_integracion_tiempo ON dw.fact_integracion_yauctions(id_tiempo);
 
-- ---------- Hechos: recomendaciones ----------
CREATE TABLE dw.fact_recomendaciones (
    id_fact_recomendacion  BIGSERIAL PRIMARY KEY,
    id_tiempo              INT NOT NULL REFERENCES dw.dim_tiempo(id_tiempo),
    id_cliente_dw          BIGINT NOT NULL REFERENCES dw.dim_cliente(id_cliente_dw),
    id_producto_dw         BIGINT NOT NULL REFERENCES dw.dim_producto(id_producto_dw),
    puntaje                 NUMERIC(5,4) NOT NULL,
    fue_clic                BOOLEAN NOT NULL DEFAULT FALSE,
    fue_compra              BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_fact_recomendaciones_tiempo ON dw.fact_recomendaciones(id_tiempo);
 
-- ---------- Control del proceso ETL ----------
CREATE TABLE dw.etl_log (
    id_corrida         BIGSERIAL PRIMARY KEY,
    proceso             VARCHAR(60) NOT NULL,
    fecha_inicio         TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_fin             TIMESTAMPTZ,
    filas_procesadas      INT,
    estado                 VARCHAR(15) NOT NULL DEFAULT 'EN_CURSO',  -- EN_CURSO|EXITOSO|FALLIDO
    detalle_error          TEXT
);
 
-- Rol de solo lectura para Power BI (ver apartado 15.9.6)
CREATE ROLE bi_reader LOGIN PASSWORD :'bi_reader_password';
GRANT USAGE ON SCHEMA dw TO bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO bi_reader;
