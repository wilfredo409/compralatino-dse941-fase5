# Validación de Base de Datos, Migraciones y Proceso ETL – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Validación de Inicialización y Migraciones (`deploy/db-init`)
Se verificó el orden de ejecución y consistencia de los scripts DDL en PostgreSQL 16:
1. `00_schema_fase2.sql`: Creación del modelo relacional transaccional base.
2. `01_migracion_001.sql`: Control de migraciones aditivas de Fase 3.
3. `02_migracion_002.sql`: Índices y restricciones de integridad referencial.
4. `03_migracion_003.sql`: Estructuras complementarias de Fase 4.

---

## 2. Consulta y Verificación de Claves Foráneas Huérfanas
Ejecutada directamente sobre el contenedor `cl-test-db` (`compralatino_test`):

```sql
SELECT COUNT(*) AS pedidos_huerfanos 
FROM pedidos p 
LEFT JOIN usuarios u ON p.id_usuario = u.id 
WHERE u.id IS NULL;

### 2. Archivo: `docs/qa/evidencias/prueba_carga_rendimiento.md`


```markdown
# Reporte de Pruebas de Carga y Rendimiento (RNF-01) – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Especificaciones del Entorno Local de Pruebas
- **CPU:** Intel(R) Core(TM) i7-4510U CPU @ 2.00GHz (2 Cores, 4 Hilos)
- **Sistema Operativo:** Microsoft Windows 64-bit
- **Motor de Contenedores:** Docker Desktop / PostgreSQL 16-alpine (`cl-test-db`)

---

## 2. Estado de Ejecución de Autocannon
- **Estado en ambiente local:** **No ejecutado localmente**.
- **Justificación técnica:** Debido a limitaciones de hardware y concurrencia local (2 núcleos físicos / 4 hilos), la simulación de ráfagas de 50 conexiones concurrentes genera saturación en el hilo de procesamiento local, afectando la representatividad de la métrica $p90$.
- **Plan de acción / Deuda Técnica (DT-01):** La ejecución automatizada de pruebas de carga y estrés se delega al pipeline de Integración Continua (CI/CD) bajo agentes dedicados de prueba para la Fase 5.