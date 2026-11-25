# Verificación de la Fase 5 de CompraLatino

Se usó una base sintética aislada en PostgreSQL 17, Node.js 24 y Chrome local el 25 de noviembre de 2026. La configuración de entrega fija PostgreSQL 16 y Node.js 22 en Docker y CI.

| Control | Resultado observado | Cómo reproducir |
| --- | --- | --- |
| Backend | 80 pruebas aprobadas, 0 fallos y 0 omitidas. Cobertura de líneas de 92.18 % con un umbral de 80 %. | `npm run test:coverage` en backend con una base de pruebas y el esquema aplicado. |
| Vue | Construcción de producción aprobada. | `npm run build` en frontend. |
| Humo en Chrome | 14 pasos aprobados. Se incluyeron el cuadro ejecutivo a 1280, 768 y 375 px, el cambio de periodo, el escenario de ventas y la descarga CSV autenticada. | `npm run smoke` en pruebas, con los perfiles sintéticos y las variables explicadas en su README. |
| Catálogo | 500 respuestas válidas, 0 errores, 20 secuencias concurrentes, p90 de 268.56 ms. | `node pruebas/carga_catalogo.mjs` con la aplicación local y el catálogo sembrado. |
| ETL | Dos corridas consecutivas conciliaron todas las cabeceras elegibles. Los conteos se mantuvieron en 6 clientes, 25 productos, 10 hechos de venta, 4 pujas y 13 recomendaciones. | `psql -v ON_ERROR_STOP=1 -f bi/ejecutar_etl.sql` y `psql -f bi/verificar_etl.sql` después de usar la aplicación con la muestra sintética. |
| Recuperación | Copia de 107 897 bytes restaurada en una base separada. Conciliación y conteos coincidieron con el origen. | `pg_dump -Fc`, `pg_restore --exit-on-error` y `bi/verificar_etl.sql` con el procedimiento del manual de instalación. |
| Empaquetado | La configuración de Docker Compose pasó la validación sintáctica local. | `docker compose config --quiet` con variables locales de verificación. |

Los resultados de carga describen ese perfil de entorno local. Las credenciales externas, el despliegue comercial, TLS en el dominio de destino, el escaneo dinámico externo y la publicación de los informes Power BI quedan sujetos a verificación en el entorno autorizado.
