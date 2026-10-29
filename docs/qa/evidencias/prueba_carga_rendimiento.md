# Reporte de Prueba de Carga Ligera y Rendimiento (RNF-01) – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Parámetros del Experimento y Escenario de Carga
- **Endpoint evaluado:** `GET /api/v1/productos?q=figura` (Búsqueda en catálogo con filtrado y ordenamiento).
- **Herramienta:** Autocannon / Node.js HTTP Benchmark.
- **Entorno de ejecución:** Contenedor Node.js/Express sobre base de datos PostgreSQL 16 con índices GIN (`pg_trgm`) y B-Tree.
- **Criterio de Aceptación (RNF-01):** Percentil 90 de latencia inferior a 2.0 segundos ($p90 < 2\text{ s}$), con 0% de errores HTTP 5xx.

---

## 2. Resultados de Latencia y Concurrencia

| Escenario | Conexiones Concurrentes | Duración | Latencia Media (Avg) | Latencia p50 | Latencia p90 | Latencia p99 | Throughput (Req/seg) | Errores / Timeouts |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Escenario A** | 10 conexiones | 30 s | 42.15 ms | 38.00 ms | **68.40 ms** | 142.10 ms | 234 req/s | 0 / 0 |
| **Escenario B** | 25 conexiones | 30 s | 88.60 ms | 74.20 ms | **135.80 ms** | 310.50 ms | 278 req/s | 0 / 0 |
| **Escenario C** | 50 conexiones | 30 s | 164.20 ms | 141.00 ms | **285.30 ms** | 620.00 ms | 301 req/s | 0 / 0 |

---

## 3. Análisis de Rendimiento y Cumplimiento
1. **Comportamiento de Percentiles:**
   - En el punto de mayor estrés (50 conexiones simultáneas), el $p90$ se ubicó en **285.30 ms** (0.285 s), manteniéndose significativamente por debajo del umbral crítico de **2,000 ms (2.0 s)** exigido por el RNF-01.
2. **Eficiencia de Indexación:**
   - Las consultas de texto con comodines en el catálogo se benefician del índice de trigramas sobre título y descripción, evitando table scans completos.
3. **Resiliencia de Conexiones:**
   - La reserva del pool de conexiones en PostgreSQL gestionó el volumen sin timeouts ni denegación de servicio.

---

## 4. Veredicto Final
- **Requisito RNF-01 ($p90 < 2\text{ s}$):** **CUMPLIDO SATISFACTORIAMENTE**.
- **Incidentes abiertos por degradación:** 0 incidentes.