# Pruebas reproducibles de CompraLatino

El humo de navegador comprueba el catálogo y sus imágenes, búsqueda y filtros, ingreso y permisos,
recomendaciones, cuenta, compra y puja simuladas, navegación responsiva y el panel administrativo.
La suite de backend cubre el registro y las transiciones del Circuit Breaker.

```bash
# 1) Tener corriendo backend (:3000), frontend (:5173) y la BD sembrada (ver ../README.md)
cd pruebas
npm ci
npx playwright install chromium

# PowerShell: credenciales tomadas de la configuración de demostración, no guardadas en el test.
$env:SMOKE_CLIENT_EMAIL = "correo-cliente-demo"
$env:SMOKE_CLIENT_PASSWORD = "contraseña-cliente-demo"
$env:SMOKE_ADMIN_EMAIL = "correo-admin-demo"
$env:SMOKE_ADMIN_PASSWORD = "contraseña-admin-demo"
$env:BASE_URL = "http://127.0.0.1:8080"
npm run smoke
```
Para el entorno de desarrollo, usar `BASE_URL=http://127.0.0.1:5173`; para Docker Compose
usar `BASE_URL=http://127.0.0.1:8080`. Se requieren credenciales de un cliente y un administrador
sembrados; las variables `SMOKE_*` evitan almacenar esos datos en el archivo de pruebas.

Cada paso imprime `OK` o `FAIL`; si falla, guarda una captura en la carpeta temporal del sistema.

Para medir búsqueda en un entorno aislado con datos de prueba, ejecuta desde la raíz `node pruebas/carga_catalogo.mjs` con `BASE_URL` configurada. El perfil envía 500 búsquedas en 20 secuencias concurrentes y exige p90 menor de 2.000 ms y cero errores. Registra el ambiente y el JSON resultante.

La conciliación de BI usa `bi/verificar_etl.sql` después de cada corrida. Los resultados de verificación de la versión se registran en [Fase 5](../docs/fase5/verificacion.md).
