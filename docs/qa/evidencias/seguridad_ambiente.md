# Seguridad del Ambiente, Dependencias y Configuración – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Auditoría Estática de Dependencias (`npm audit`)
- Ejecución realizada en backend y frontend.
- Dependencias base de producción verificadas sin vulnerabilidades bloqueantes.

## 2. Configuración del Ambiente
- **CORS:** Middleware `cors()` general activo en `app.js` para desarrollo e integración local (pendiente endurecimiento por lista blanca en despliegue productivo).
- **Secretos:** Credenciales y `DATABASE_URL` aisladas mediante variables de entorno en `.env`.
- **Arquitectura:** Operación directa sobre contenedores Docker sin dependencia de servicios Redis.

## 3. Escaneo OWASP ZAP
- **Estado:** No ejecutado en el ambiente local en esta iteración. Se registra para ejecución en pipeline CI/CD.