-- ============================================================================
-- CompraLatino — Esquema de base de datos (PostgreSQL 16)
-- Formaliza como script ejecutable el modelo entidad-relación de la Figura 10
-- (apartado 9.10 y Anexo D.10 del documento de Fase 2).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- índice de similitud de texto

-- ----------------------------------------------------------------------------
-- M1 · Cuentas
-- ----------------------------------------------------------------------------

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(72)  NOT NULL,
    nombre          VARCHAR(80)  NOT NULL,
    apellido        VARCHAR(80)  NOT NULL,
    telefono        VARCHAR(25),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'pendiente_verificacion'
                        CHECK (estado IN ('activo','suspendido','pendiente_verificacion')),
    fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(40)  NOT NULL UNIQUE,
    descripcion  VARCHAR(150)
);

CREATE TABLE usuario_rol (
    id_usuario  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_rol      INT  NOT NULL REFERENCES roles(id)    ON DELETE RESTRICT,
    PRIMARY KEY (id_usuario, id_rol)
);

CREATE TABLE direcciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pais           VARCHAR(60)  NOT NULL,
    departamento   VARCHAR(60)  NOT NULL,
    ciudad         VARCHAR(60)  NOT NULL,
    detalle        VARCHAR(200) NOT NULL,
    es_principal   BOOLEAN NOT NULL DEFAULT false
);

-- ----------------------------------------------------------------------------
-- M2 · Catálogo y productos
-- ----------------------------------------------------------------------------

CREATE TABLE categorias (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(80) NOT NULL,
    id_padre   INT REFERENCES categorias(id) ON DELETE SET NULL
);

CREATE TABLE productos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_externo_ya          VARCHAR(60)  NOT NULL UNIQUE,
    id_categoria           INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    titulo                 VARCHAR(200) NOT NULL,
    descripcion            TEXT,
    precio_jpy             NUMERIC(12,2) NOT NULL,
    precio_usd             NUMERIC(12,2),
    tipo_venta             VARCHAR(20) NOT NULL CHECK (tipo_venta IN ('fijo','subasta')),
    fecha_fin_subasta      TIMESTAMPTZ,
    stock                  INT NOT NULL DEFAULT 0,
    fecha_sincronizacion   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE producto_imagenes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_producto   UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    url_blob      VARCHAR(300) NOT NULL,
    orden         SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE tipo_cambio (
    id               SERIAL PRIMARY KEY,
    moneda_origen    CHAR(3) NOT NULL,
    moneda_destino   CHAR(3) NOT NULL,
    tasa             NUMERIC(12,6) NOT NULL,
    margen           NUMERIC(5,4)  NOT NULL,
    vigencia_desde   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- M3 · Compras
-- ----------------------------------------------------------------------------

CREATE TABLE pedidos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo           VARCHAR(20) NOT NULL UNIQUE,
    id_usuario       UUID NOT NULL REFERENCES usuarios(id)    ON DELETE RESTRICT,
    id_direccion     UUID REFERENCES direcciones(id)          ON DELETE SET NULL,
    estado           VARCHAR(25) NOT NULL DEFAULT 'creado'
                        CHECK (estado IN ('creado','pagado','en_proceso','enviado','entregado','cancelado')),
    subtotal_usd     NUMERIC(12,2) NOT NULL,
    flete_usd        NUMERIC(12,2) NOT NULL DEFAULT 0,
    comision_usd     NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_usd        NUMERIC(12,2) NOT NULL,
    fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedido_detalle (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido             UUID NOT NULL REFERENCES pedidos(id)  ON DELETE CASCADE,
    id_producto           UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad              INT NOT NULL CHECK (cantidad > 0),
    precio_unitario_usd   NUMERIC(12,2) NOT NULL
);

CREATE TABLE pujas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido      UUID NOT NULL REFERENCES pedidos(id)  ON DELETE CASCADE,
    id_producto    UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    monto_jpy      NUMERIC(12,2) NOT NULL,
    estado         VARCHAR(20) NOT NULL DEFAULT 'enviada'
                       CHECK (estado IN ('enviada','aceptada','superada','rechazada')),
    fecha_envio    TIMESTAMPTZ NOT NULL DEFAULT now(),
    respuesta_ya   JSONB
);

CREATE TABLE pagos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido           UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    proveedor           VARCHAR(40) NOT NULL,
    token_transaccion   VARCHAR(120) NOT NULL,
    monto               NUMERIC(12,2) NOT NULL,
    estado              VARCHAR(20) NOT NULL
                            CHECK (estado IN ('autorizado','capturado','rechazado')),
    fecha               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE envios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pedido         UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    transportista     VARCHAR(60),
    numero_guia       VARCHAR(60),
    estado            VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    fecha_estimada    DATE
);

-- ----------------------------------------------------------------------------
-- M4 · Recomendaciones
-- ----------------------------------------------------------------------------

CREATE TABLE historial_navegacion (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario     UUID NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    id_producto    UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    fecha_visita   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recomendaciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    id_producto         UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    puntaje             NUMERIC(5,4) NOT NULL,
    motivo              VARCHAR(120),
    fecha_generacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- M5 · Administración
-- ----------------------------------------------------------------------------

CREATE TABLE auditoria (
    id               BIGSERIAL PRIMARY KEY,
    id_usuario       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion           VARCHAR(60) NOT NULL,
    entidad          VARCHAR(60) NOT NULL,
    id_entidad       VARCHAR(60),
    datos_previos    JSONB,
    fecha            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Índices (según nota de la Figura 10)
-- ----------------------------------------------------------------------------

CREATE INDEX idx_productos_categoria ON productos (id_categoria);
CREATE INDEX idx_productos_titulo    ON productos USING GIN (titulo gin_trgm_ops);
CREATE UNIQUE INDEX idx_productos_id_externo ON productos (id_externo_ya);

-- Índices de apoyo para los patrones de acceso más frecuentes de la API (Tabla 23)
CREATE INDEX idx_pedidos_usuario           ON pedidos (id_usuario);
CREATE INDEX idx_pedido_detalle_pedido     ON pedido_detalle (id_pedido);
CREATE INDEX idx_pujas_pedido              ON pujas (id_pedido);
CREATE INDEX idx_historial_usuario_fecha   ON historial_navegacion (id_usuario, fecha_visita DESC);
CREATE INDEX idx_recomendaciones_usuario   ON recomendaciones (id_usuario);
CREATE INDEX idx_auditoria_fecha           ON auditoria (fecha DESC);

COMMIT;
