# Plan de Pruebas de Calidad (QA) – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Alcance y Objetivos de Calidad
Establecer los criterios de verificación y validación para el software funcional integrado de CompraLatino (Backend en Node.js/Express, Frontend en Vue 3 y Persistencia en PostgreSQL/Docker).

- **Pruebas Unitarias y de Integración:** Verificación de controladores, middleware de autenticación (JWT), manejo centralizado de errores y lógica de resiliencia del adaptador YAuctions (Circuit Breaker).
- **Cobertura de Código:** Establecer umbral de monitoreo automatizado con `c8` / Node.js test runner con una meta base del 50%–60% de cobertura de líneas en servicios desacoplados.
- **Pruebas de Seguridad (RNF-02):** Auditoría estática de dependencias mediante `npm audit`, validación de políticas CORS, aislamiento de credenciales en `.env` y análisis dinámico inicial de endpoints con OWASP ZAP.
- **Pruebas de Rendimiento y Carga (RNF-01):** Validación de latencia en peticiones concurrentes sobre el catálogo y endpoints de lectura, exigiendo un percentil 90 ($p90 < 2\text{ s}$).

---

## 2. Estrategia y Tipos de Pruebas
- **Pruebas Unitarias:** Ejecutadas con el runner nativo de Node.js (`test/*.test.js`).
- **Pruebas de Integración de API:** Cobertura de endpoints protegidos por roles (`admin`, `cliente`).
- **Pruebas de Resiliencia y Fallo:** Validación del patrón Circuit Breaker ante caídas simuladas de servicios externos (estados: cerrado, abierto, semi-abierto).
- **Pruebas de Migración de Base de Datos:** Verificación de scripts SQL aditivos y consistencia referencial en PostgreSQL.

---

## 3. Criterios de Aceptación y Salida
- 0 fallos críticos bloqueantes (`failed: 0`).
- Ejecución repetible en entornos locales vía Docker y en CI/CD.
- Registro de no conformidades y mitigaciones en la matriz de incidentes (Q-6).