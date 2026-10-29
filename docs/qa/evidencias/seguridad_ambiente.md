# Seguridad del Ambiente, Dependencias y Configuración – Fase 4

- **Estudiante:** Lucía Milena Hernández Bonilla (HB221258)
- **Rol Fase 4:** DevOps / QA / Base de Datos
- **Revisores:** Fernando López / David Cardona
- **Proyecto:** CompraLatino (DSE941)

---

## 1. Auditoría Estática de Dependencias (`npm audit`)
- **Backend:** 
  - Ejecución de `npm audit` reporta 2 vulnerabilidades (1 moderada, 1 alta en utilidades de desarrollo/transpilación).
  - No afectan la exposición directa del runtime de producción; clasificadas como bajo riesgo de explotación directa bajo aislamiento en contenedores.
- **Frontend:** 
  - Auditoría ejecutada con 0 vulnerabilidades críticas en paquetes de interfaz de usuario.

---

## 2. Configuración del Ambiente y Gestión de Secretos
- **Secretos Desacoplados:**
  - Variables críticas (`DATABASE_URL`, `JWT_SECRET`, credenciales de API) administradas exclusivamente vía variables de entorno (`process.env`).
  - Archivos locales `.env` excluidos del control de versiones mediante reglas en `.gitignore`.
- **Políticas de CORS:**
  - Middleware configurado en `backend/src/app.js` restringido al origen de la aplicación web cliente, evitando peticiones cruzadas no autorizadas.
- **Aislamiento de Red:**
  - Servicios de base de datos PostgreSQL y Redis contenidos en red interna de Docker Compose sin exposición innecesaria de puertos administrativos.

---

## 3. Escaneo de Vulnerabilidades Web (OWASP ZAP Baseline)
- **Objetivo:** Análisis dinámico sobre endpoints locales expuestos (`http://localhost`).
- **Hallazgos evaluados:**
  - Cabeceras de seguridad HTTP recomendadas (adición sugerida de `X-Content-Type-Options: nosniff` y `Content-Security-Policy`).
  - Ausencia de exposición de stack trace de errores internos hacia el cliente (código 500 saneado con mensajes genéricos controlados).