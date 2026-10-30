# Validación de Base de Datos, Migraciones y Proceso ETL – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Validación de Inicialización y Migraciones (`deploy/db-init`)
Se verificó el orden secuencial de los scripts DDL en PostgreSQL 16:
1. `00_schema_fase2.sql`: Esquema relacional transaccional base (tablas operativas, claves primarias e índices).
2. `01_migracion_001.sql`: Control de migraciones aditivas de Fase 3.
3. `02_migracion_002.sql`: Ampliación del tamaño de columna en `usuarios.estado` (defecto resuelto en Fase 3).
4. `03_migracion_003.sql`: Restricción de verificación `CHECK (stock >= 0)` en catálogo (Fase 3).

---

## 2. Verificación Puntual de Claves Foráneas (pedidos → usuarios)
Se ejecutó una comprobación puntual de integridad referencial entre las tablas operativas `pedidos` y `usuarios` sobre el contenedor activo `cl-test-db` (`compralatino_test`):

```sql
SELECT COUNT(*) AS pedidos_huerfanos 
FROM pedidos p 
LEFT JOIN usuarios u ON p.id_usuario = u.id 
WHERE u.id IS NULL;

```

**Resultado obtenido:**
```text
 pedidos_huerfanos 
-------------------
                 0
(1 row)
```

- **Alcance:** Verificación puntual de consistencia referencial en la relación `pedidos.id_usuario = usuarios.id` (0 registros huérfanos). No constituye una auditoría exhaustiva de la totalidad de restricciones del esquema.

---

## 3. Estado de Validación del Esquema ETL / Data Warehouse
- **Estado:** **No ejecutado en esta iteración.**
- **Detalle:** La verificación del proceso ETL hacia el esquema `dw` (`fact_transacciones` y dimensiones analíticas) no fue ejecutada en el ambiente local, quedando pendiente su validación técnica para la siguiente fase.