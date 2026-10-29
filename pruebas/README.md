# Prueba de humo (smoke test) — CompraLatino Fase 3

Recorre en un navegador real el flujo completo: catálogo, registro/login, compra directa con pago,
oferta de subasta con Circuit Breaker, recomendaciones y panel administrativo.

```bash
# 1) Tener corriendo backend (:3000), frontend (:5173) y la BD sembrada (ver ../README.md)
cd pruebas
npm install
npx playwright install chromium

# PowerShell: credenciales tomadas de la configuración de demostración, no guardadas en el test.
$env:SMOKE_CLIENT_EMAIL = "correo-cliente-demo"
$env:SMOKE_CLIENT_PASSWORD = "contraseña-cliente-demo"
$env:SMOKE_ADMIN_EMAIL = "correo-admin-demo"
$env:SMOKE_ADMIN_PASSWORD = "contraseña-admin-demo"
$env:BASE_URL = "http://localhost"
npm run smoke
```
Para el entorno de desarrollo, usar `BASE_URL=http://localhost:5173`; para Docker Compose
o el despliegue publicado en el puerto 80, usar `BASE_URL=http://localhost` o
`BASE_URL=http://IP_PUBLICA`. Se requieren credenciales de un cliente y un administrador
sembrados; las variables `SMOKE_*` evitan almacenar esos datos en el archivo de pruebas.

Cada paso imprime `OK` o `FAIL`; si falla, guarda una captura en la carpeta temporal del sistema.
