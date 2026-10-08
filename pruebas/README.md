# Prueba de humo (smoke test) — CompraLatino Fase 3

Recorre en un navegador real el flujo completo: catálogo, registro/login, compra directa con pago,
oferta de subasta con Circuit Breaker, recomendaciones y panel administrativo.

```bash
# 1) Tener corriendo backend (:3000), frontend (:5173) y la BD sembrada (ver ../README.md)
cd pruebas
npm install
npx playwright install chromium
npm run smoke            # o:  BASE_URL=http://IP_PUBLICA npm run smoke   (contra el despliegue en AWS)
```
Cada paso imprime `OK` o `FAIL`; si falla, guarda una captura en la carpeta temporal del sistema.
