# Reporte de Pruebas de Carga y Rendimiento (RNF-01) – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Especificaciones del Entorno Local
- **CPU:** Intel(R) Core(TM) i7-4510U CPU @ 2.00GHz (2 núcleos físicos, 4 lógicos)
- **Sistema Operativo:** Microsoft Windows 64-bit
- **Motor de Contenedores:** Docker Desktop / PostgreSQL 16-alpine (`cl-test-db`)

---

## 2. Estado de Ejecución
- **Estado:** **No ejecutado en el ambiente local.**
- **Justificación:** Debido a la capacidad de cómputo local (2 núcleos / 4 hilos), la ejecución de pruebas de estrés y concurrencia con Autocannon distorsiona las métricas reales de latencia.
- **Seguimiento (DT-01):** La ejecución automatizada de pruebas de carga y la verificación formal de latencia ($p90 < 2\text{ s}$) se delega al pipeline de CI/CD sobre agentes dedicados en la Fase 5.