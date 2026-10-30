# Plan de Pruebas de Calidad (QA) – Fase 4

- **Responsable:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Alcance y Objetivos de Calidad
Establecer los criterios de verificación y aseguramiento de calidad sobre el backend y base de datos de CompraLatino:
- **Pruebas Unitarias y de Integración:** Verificación de rutas de API, adaptadores externos (`YAuctionsAdapter`), middleware de autenticación (JWT) y manejo centralizado de excepciones con persistencia en contenedor Docker.
- **Cobertura de Código:** Medición mediante el runner nativo de Node.js (`node --test --experimental-test-coverage`) garantizando un umbral mínimo del **80% de cobertura de líneas** sobre el backend.
- **Seguridad (RNF-02):** Auditoría de dependencias mediante `npm audit`, aislamiento de variables en `.env` y registro de vulnerabilidades en producción.
- **Rendimiento (RNF-01):** Definición del criterio de latencia percentil 90 ($p90 < 2\text{ s}$), programado para validación en pipeline CI/CD.

---

## 2. Estrategia y Entorno de Ejecución
- **Runner:** Node.js Test Runner nativo.
- **Base de Datos:** Contenedor Docker dedicado `cl-test-db` en puerto `5433` con base `compralatino_test`.
- **Criterio de Aceptación:** 100% de pruebas pasando (0 fail), 0 pruebas omitidas por falta de base de datos y cobertura de líneas >80%.