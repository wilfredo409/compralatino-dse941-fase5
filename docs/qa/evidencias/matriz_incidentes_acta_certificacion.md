# Matriz de Incidentes y Acta de Certificación – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos

---

## 1. Matriz de Incidentes y Hallazgos

| ID | Tipo | Descripción | Estado |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Seguridad | CORS permisivo (`cors()`) en `backend/src/app.js`. Requiere lista blanca por origen. | Abierto / Mitigación en config |
| **SEC-02** | Seguridad | Dependencias de desarrollo reportadas en `npm audit` sin impacto directo en runtime. | Documentado |
| **UI-01** | Interfaz | Ajustes de responsividad y validación de formularios reportados por Frontend (Fernando). | En corrección |
| **DT-01** | Deuda Técnica | Automatización de pipeline para escaneo dinámico DAST (ZAP) y benchmarks en CI/CD. | Registrado para Fase 5 |

---

## 2. Acta de Verificación de Calidad

- **Verificado:** Suite completa de pruebas ejecutada con base de pruebas `cl-test-db` en puerto 5433, alcanzando **91.41% de cobertura de líneas** (superando el 80% requerido).
- **No verificado en local:** Escaneo activo OWASP ZAP y pruebas de estrés distribuidas (registrados bajo deuda técnica DT-01).
- **Dictamen:** Aprobada la entrega de pruebas unitarias y de integración para la Fase 4, pendiente de consolidación y firma colegiada del equipo.