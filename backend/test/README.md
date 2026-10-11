# Pruebas automatizadas del backend

Usan el ejecutor integrado de Node.js (`node:test`) y `supertest`; no hay que instalar nada más que las dependencias del backend (`npm ci`).

```
npm test                 # corre todas las pruebas
npm run test:coverage    # igual, y falla si la cobertura de líneas del código fuente baja de 80 %
```

## Qué cubren

| Carpeta | Archivo | Qué comprueba |
|---|---|---|
| `unit/` | `pagination-jwt.test.js` | Cursor de paginación, límite por defecto/máximo y tokens JWT (access y refresh). |
| `unit/` | `yauctions-adapter.test.js` | Circuit Breaker de YAuctionsAdapter: cerrado → abierto tras 3 fallos → semi-abierto tras el enfriamiento → cerrado de nuevo; caché del catálogo. |
| `api/` | `auth.test.js` | Registro, login, refresh, rutas protegidas y que un cliente no entre al panel de administración. |
| `api/` | `pedidos.test.js` | Compra directa (subtotal, flete de 12 USD, comisión de 5 %, stock), pago, webhook de pagos (capturado/rechazado) y aislamiento entre usuarios. |
| `api/` | `recomendaciones.test.js` | Los tres niveles de la cascada: tendencia general, navegación y compras; exclusión de lo ya comprado. |
| `api/` | `admin.test.js` | RF-05: acceso 401/403, métricas, pedidos paginados y filtrados, exportación CSV, listado y edición de usuarios, suspensión (el usuario suspendido pierde el acceso) y bitácora de auditoría. |
| `api/` | `catalogo.test.js` | Catálogo: filtros por categoría, precio, texto y tipo de venta, paginación por cursor, ficha de producto, errores 400/404 y árbol de categorías. |
| `api/` | `usuarios.test.js` | Perfil y direcciones: autenticación, validaciones, reemplazo de direcciones y reversión atómica ante una dirección inválida. |
| `api/` | `subasta.test.js` | Subasta de punta a punta: reserva en el pedido, validación de ofertas, 503 con circuito de YAuctions fallando sin guardar la puja y puja exitosa. |

Además, `pedidos.test.js` incluye la prueba de concurrencia (5 compras simultáneas con stock 2: solo 2 se aceptan, el resto recibe 409) y verifica que la restricción `CHECK (stock >= 0)` de la base de datos rechaza un stock negativo.

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
