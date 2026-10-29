# Validación de Base de Datos, Migraciones y Proceso ETL – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Validación de Inicialización y Migraciones (`deploy/db-init`)
Se verificó la secuencia de despliegue y orden de ejecución de los scripts SQL del contenedor PostgreSQL 16:

1. **`00_schema_fase2.sql` (Esquema DDL Base):**
   - Creación limpia de 16 tablas relacionales transaccionales (OLTP).
   - Verificación de tipos de datos, claves primarias (`UUID` / `SERIAL`) y restricciones foráneas en cascada.
2. **`m1_migracion_001.sql` y `m1_migracion_002.sql` (Control de Migraciones Aditivas):**
   - Corrección aplicada sobre la columna `usuarios.estado` para permitir la longitud necesaria con sellos de auditoría sin pérdida de integridad histórica.
   - Restricción de unicidad sobre correos electrónicos y códigos de seguimiento.
3. **`02_seeds.sql` (Datos Semilla):**
   - Carga inicial consistente de categorías, catálogo representativo de productos japoneses y usuarios base de prueba (`admin`, `cliente`).

---

## 2. Validación del Esquema Dimensional y ETL (`dw`)
Se validó la estructura de datos analítica desacoplada de la base transaccional para la solución de soporte a decisiones:

- **Esquema en Estrella (Star Schema):**
  - **Tabla de Hechos:** `dw.fact_transacciones` (métricas numéricas: monto JPY/USD, comisión del 8%, flete, margen cambiario del 3%).
  - **Dimensiones:** `dw.dim_tiempo`, `dw.dim_usuario`, `dw.dim_categoria`, `dw.dim_resultado_subasta`.
- **Procedimiento de Extracción y Transformación (ETL):**
  - Validación del procedimiento almacenado de agregación periódica.
  - Planificación desacoplada mediante extensión `pg_cron` (ajustable en entornos locales vía tareas programadas).
  - Integridad en la vista analítica del Panel Administrativo (`W06`), consumida por los endpoints de métricas gerenciales.

---

## 3. Estado de Restricciones Críticas y Hallazgos
- **Integridad Referencial:** 0 claves foráneas huérfanas tras ejecución de semillas.
- **Bloqueos Transaccionales:** Manejo de concurrencia atómica en transacciones de órdenes y saldo de subastas mediante `SELECT ... FOR UPDATE`.
- **Veredicto Técnico:** Base de datos lista para pruebas de integración continua y carga.