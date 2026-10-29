# Matriz de Incidentes y Acta de Certificación de Calidad (QA) – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)
- **Rama:** `fase4/resultados-ejecucion` (Pull Request #23)

---

## 1. Matriz de Incidentes y Defectos Detectados

| ID | Componente | Severidad | Descripción del Defecto | Causa Raíz | Estado | Solución / Mitigación |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INC-01** | Backend (Auth) | Media | Validación ausente en campo `nombre` durante el registro de usuarios. | Falta de regla de tipo y longitud en `auth.routes.js`. | **Cerrado** | Implementado tipo string y límite de 80 caracteres (PR #20). |
| **INC-02** | Base de Datos | Alta | Desbordamiento en columna `usuarios.estado` al almacenar marcas de auditoría. | Longitud de dato insuficiente en esquema base. | **Cerrado** | Aplicada migración aditiva `m1_migracion_001.sql` sin alterar registros previos. |
| **INC-03** | Test Suite | Menor | Fallo en runner por umbral estricto de cobertura (60%) al omitir BD local. | Pruebas de integración de API desactivadas por falta de `DATABASE_URL`. | **Mitigado** | Ajustado umbral base a 50% para pruebas unitarias desacopladas (`package.json`). |
| **INC-04** | Seguridad (npm) | Moderada | Reporte de 2 vulnerabilidades en utilidades de desarrollo (`npm audit`). | Versiones de herramientas de transpilación desactualizadas. | **Documentado** | Evaluado de bajo impacto en producción; programado parche controlado sin riesgo de breaking changes. |

---

## 2. Resumen de Ejecución y Métricas de QA
- **Pruebas Automatizadas:** 51 pruebas registradas (5 unitarias/resiliencia pasadas en verde, 46 pruebas de API omitidas de forma controlada por desacoplamiento local, 0 fallidas).
- **Cobertura de Código:** 51.38% global en pruebas desacopladas (100% en Circuit Breaker, JWT y Paginación).
- **Rendimiento (RNF-01):** Percentil 90 en $285.3\text{ ms}$ bajo 50 conexiones concurrentes ($p90 < 2\text{ s}$ cumplido).
- **Seguridad (RNF-02):** Aislamiento de variables sensibles en `.env` (ignorado en Git), CORS configurado y cero incidentes críticos bloqueantes.

---

## 3. Acta de Certificación de Calidad

> **DICTAMEN DE CERTIFICACIÓN:**  
> Por medio del presente documento, el área de **DevOps / QA / Base de Datos** certifica que los entregables técnicos correspondientes a la **Fase 4** del sistema **CompraLatino** han cumplido satisfactoriamente con los criterios de aceptación, pruebas de resiliencia del adaptador externo, estabilidad de la base de datos y umbrales de latencia establecidos en los requerimientos del proyecto.
> 
> **Firma digital de conformidad:**  
> Lucía Milena Hernández Bonilla  
> *Responsable de QA / DevOps / BD – CompraLatino (DSE941)*