# CompraLatino

Plataforma de intermediación de compras desarrollada por el equipo de DSE941 en la Universidad Don Bosco. La Fase 5 continúa el código del equipo desde el commit `95226dc` del [repositorio original](https://github.com/ciberdavisxp/compralatino-dse941/tree/95226dc).

El sistema tiene cinco módulos: cuentas, catálogo, compras, recomendaciones y administración. Incluye una SPA Vue 3, una API REST Express en Node.js 22, PostgreSQL 16 y un almacén dimensional con scripts ETL. La interfaz de YAuctions y la pasarela de pago se simulan. Usa datos y credenciales de demostración exclusivamente en un ambiente de pruebas.

## Inicio rápido

Requiere Docker con Compose v2. Copia `.env.example` a `.env` en la raíz y asigna tres secretos distintos. Usa una contraseña hexadecimal para PostgreSQL porque se incluye en una URI.

```sh
docker compose up -d --build --wait
docker compose ps
docker compose exec backend npm run seed       # Solo en una base académica vacía
```

- Aplicación en `http://127.0.0.1:8080`.
- Swagger en `http://127.0.0.1:8080/api/docs/`.
- Disponibilidad en `http://127.0.0.1:8080/api/v1/salud/listo`.
- Cuentas locales en `backend/db/seed.js`. El panel y el reporte CSV requieren rol de administrador.

Para desarrollo sin Docker, crea una base PostgreSQL vacía, aplica en orden `deploy/db-init/*.sql` con `psql -v ON_ERROR_STOP=1 -f archivo.sql` y configura `backend/.env` a partir de su ejemplo. En `backend`, ejecuta `npm ci`, `npm run seed` y `npm start`. En `frontend`, ejecuta `npm ci --legacy-peer-deps` y `npm run dev` para abrir `http://127.0.0.1:5173`.

## Operación y verificación

- [Despliegue, copias, actualizaciones y reversión](GUIA_DESPLIEGUE_AWS.md)
- [Operación del ETL y Power BI](docs/bi/operacion.md)
- [Manual de usuario](docs/fase5/manual-usuario.md)
- [Pruebas reproducibles](pruebas/README.md)
- [Procedencia de las imágenes del catálogo](docs/fase5/creditos-imagenes.md)
- [Plan de pruebas y resultados heredados](docs/qa/evidencias/plan_pruebas_qa.md)
- [Contrato OpenAPI](openapi.yaml)

El servidor web es el único servicio publicado, ligado a la interfaz local. Para un servidor externo, configura el proxy HTTPS del host y confirma las condiciones de liberación de la guía. Las migraciones de inicialización solo se aplican al crear el volumen. Conserva el volumen y toma un respaldo antes de actualizar un entorno con datos.

### Actualizar el catálogo de una demostración existente

Después de construir las imágenes de Docker del nuevo diseño, ejecuta `docker compose exec backend npm run catalogo:demo` en el entorno de demostración. El comando actualiza las fichas identificadas del catálogo anterior, agrega el surtido nuevo y conserva los identificadores y el inventario existente. Para una base de demostración vacía basta con `npm run seed`.
