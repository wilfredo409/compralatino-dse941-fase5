# Validación de Base de Datos, Migraciones y Proceso ETL – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Validación de Inicialización y Migraciones (`deploy/db-init`)
Se verificó la secuencia de ejecución de los scripts DDL en PostgreSQL 16:
1. `00_schema_fase2.sql`: Esquema relacional transaccional base.
2. `01_migracion_001.sql`: Control de migraciones aditivas de Fase 3.
3. `02_migracion_002.sql`: Índices y restricciones de integridad.
4. `03_migracion_003.sql`: Estructuras complementarias de Fase 4.

## 2. Validación de Claves Foráneas y Esquema Analítico
- **Integridad referencial:** Verificada la ausencia de registros huérfanos mediante consulta de claves foráneas entre tablas operativas (`pedidos`, `usuarios`, `subastas`).
- **Esquema DW (`dw`):** Tablas de hechos y dimensiones verificadas para analítica.