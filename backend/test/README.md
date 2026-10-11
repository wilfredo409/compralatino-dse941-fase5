# Pruebas automatizadas del backend

Usan el ejecutor integrado de Node.js (`node:test`) y `supertest`; no hay que instalar nada más que las dependencias del backend (`npm ci`).

```
npm test
```

## Qué cubren

| Carpeta | Archivo | Qué comprueba |
|---|---|---|
| `unit/` | `pagination-jwt.test.js` | Cursor de paginación, límite por defecto/máximo y tokens JWT (access y refresh). |
| `unit/` | `yauctions-adapter.test.js` | Circuit Breaker de YAuctionsAdapter: cerrado → abierto tras 3 fallos → semi-abierto tras el enfriamiento → cerrado de nuevo; caché del catálogo. |
| `api/` | `auth.test.js` | Registro, login, refresh, rutas protegidas y que un cliente no entre al panel de administración. |
| `api/` | `pedidos.test.js` | Compra directa (subtotal, flete de 12 USD, comisión de 5 %, stock), pago, webhook de pagos (capturado/rechazado) y aislamiento entre usuarios. |
| `api/` | `recomendaciones.test.js` | Los tres niveles de la cascada: tendencia general, navegación y compras; exclusión de lo ya comprado. |

## Pruebas que necesitan base de datos

Las de `api/` necesitan un PostgreSQL con el esquema de `deploy/db-init`. Si `DATABASE_URL` no está definida, esas pruebas se **omiten** (aparecen como *skipped*) y solo corren las unitarias.

Para correrlas en tu computadora (PowerShell, desde la carpeta raíz del repositorio, con Docker Desktop abierto):

```powershell
docker run -d --name cl-test-db -e POSTGRES_USER=compralatino -e POSTGRES_PASSWORD=pruebas -e POSTGRES_DB=compralatino -p 5433:5432 -v "${PWD}/deploy/db-init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine
cd backend
npm ci
$env:DATABASE_URL = "postgres://compralatino:pruebas@localhost:5433/compralatino"
npm test
```

Para limpiar al terminar: `docker rm -f cl-test-db`.

Las pruebas crean sus propios datos con un sufijo único y los borran al terminar, así que se pueden repetir y no dependen del seed. En GitHub Actions el flujo `ci.yml` levanta el PostgreSQL y carga el esquema automáticamente.
