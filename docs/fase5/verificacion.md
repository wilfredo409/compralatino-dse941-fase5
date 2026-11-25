# Verificación de la Fase 5 de CompraLatino

La revisión del catálogo y los manuales se realizó el 25 de noviembre de 2026. La versión de software es [`06c2e7e`](https://github.com/wilfredo409/compralatino-dse941-fase5/tree/06c2e7e4dd4c2d1c17fa8ab124b32e1b29e51fcc). Se usaron Docker Compose con Node.js 22, PostgreSQL 16 y nginx, datos sintéticos y Chrome. El piloto local y la instancia de verificación usaron bases separadas.

| Control | Resultado observado | Cómo reproducir |
| --- | --- | --- |
| Backend | 81 pruebas aprobadas, 0 fallidas y 0 omitidas. La cobertura local de líneas fue de 92,15 %, frente al umbral del 80 %. | `npm run test:coverage` en backend con una base de pruebas y el esquema aplicado. |
| GitHub Actions | Backend, compilación Vue e imágenes Docker aprobados en la [ejecución 45679619645](https://github.com/wilfredo409/compralatino-dse941-fase5/actions/runs/45679619645). La ejecución también verificó dos cargas del ETL. | Consulta la ejecución pública. Para una instalación local, usa `docker compose up -d --build --wait`. |
| Humo en Chrome | 16 comprobaciones aprobadas. Incluyen las 36 imágenes WebP, búsqueda, filtros, retorno a la ficha tras el ingreso, permisos, cuenta, compra, puja, panel administrativo y CSV. Tienda y panel revisados a 1440, 768 y 375 px. | `npm run smoke` en pruebas con los perfiles sintéticos y las variables explicadas en su README. |
| Carga del catálogo | 500 respuestas válidas, 0 errores, 20 secuencias concurrentes y p90 de 234,78 ms, frente al umbral de 2.000 ms. | `node pruebas/carga_catalogo.mjs` con la aplicación local y el catálogo sembrado. |
| Actualización del piloto | Se conservaron los 25 identificadores y las existencias anteriores. Dos ejecuciones de actualización dejaron 36 artículos, cada uno con su imagen. | Haz un respaldo y aplica el procedimiento de actualización del catálogo de la [guía de instalación](../../GUIA_DESPLIEGUE_AWS.md) en una copia de la base de demostración anterior. |
| ETL | Dos corridas en la instancia aislada conciliaron las cabeceras elegibles. Los conteos se mantuvieron en 6 clientes, 36 productos, 8 hechos de venta, 5 pujas y 16 recomendaciones. Se registraron diez etapas exitosas entre las dos corridas. | `psql -v ON_ERROR_STOP=1 -f bi/ejecutar_etl.sql` y `psql -f bi/verificar_etl.sql` después de usar la aplicación con la muestra sintética. |
| Recuperación | Copia de 112.310 bytes restaurada en una base PostgreSQL separada. La conciliación, los conteos y las etapas coincidieron con el origen. | `pg_dump -Fc`, `pg_restore --exit-on-error` y `bi/verificar_etl.sql` con el procedimiento del manual de instalación. |

Los resultados de carga corresponden al entorno local y los conteos al conjunto sintético utilizado. Las credenciales externas, el despliegue comercial, TLS en el dominio de destino, el escaneo dinámico externo y la publicación de los informes Power BI quedan sujetos a verificación en el entorno autorizado.
