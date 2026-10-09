# CompraLatino — Código fuente Fase 3 (DSE941)

Primera versión funcional del software: backend Node.js + Express sobre
PostgreSQL 16 y frontend en Vue.js 3. La implementación del contrato `openapi.yaml` y el esquema
`schema.sql` definidos en la Fase 2, complementados durante la Fase 3 mediante migraciones controladas para los ajustes detectados durante la construcción.

Ya se probó de punta a punta en un entorno limpio (PostgreSQL 16 real, no
simulado): registro/login, catálogo con filtros, compra directa con pago,
oferta de subasta con Circuit Breaker, motor de recomendaciones (sus 3
niveles de fallback) y el panel administrativo completo — ver
`supuestos_fase3.md` en la carpeta padre para el detalle de qué se asumió y
qué falta confirmar con el docente.

## 1. Requisitos

- Node.js 18+ (probado con Node 22).
- PostgreSQL 16 corriendo localmente (o accesible por `DATABASE_URL`).

## 2. Base de datos

```bash
createdb compralatino
psql -d compralatino -f deploy/db-init/00_schema_fase2.sql
psql -d compralatino -f deploy/db-init/01_migracion_001.sql
psql -d compralatino -f deploy/db-init/02_migracion_002.sql
```

Las migraciones complementan el esquema de la Fase 2 con los ajustes detectados durante la construcción de la primera versión funcional. Entre ellos se incluye la generación del código secuencial de pedidos y la ampliación del campo `usuarios.estado` para admitir correctamente el valor `pendiente_verificacion`.

## 3. Backend

```bash
cd backend
cp .env.example .env        # ajustar DATABASE_URL si es necesario
npm install
npm run seed                 # datos de demostración (catálogo, usuarios, historial)
npm start                    # http://localhost:3000/api/v1
```

Usuarios de prueba que crea el seed (contraseñas en `db/seed.js`):

| Correo | Contraseña | Rol |
|---|---|---|
| admin@compralatino.com | Admin1234! | administrador |
| laura.pineda@demo.compralatino.com | Demo1234! | cliente (con compras) |
| fernando.lopez@demo.compralatino.com | Demo1234! | cliente (con compras) |
| lucia.hernandez@demo.compralatino.com | Demo1234! | cliente (solo navegación) |
| david.cardona@demo.compralatino.com | Demo1234! | cliente (sin historial) |
| edwin.ceron@demo.compralatino.com | Demo1234! | cliente (con compras) |

### Demostrar el Circuit Breaker de YAuctionsAdapter

Dos formas:
1. Subir `YAUCTIONS_FAILURE_RATE` en `.env` (p. ej. `0.9`) y reiniciar — las
   ofertas fallarán la mayoría de las veces hasta que el circuito se abra.
2. Sin tocar el `.env`: enviar `"simularFallo": true` en el cuerpo de
   `POST /pedidos/{id}/ofertas` — fuerza el fallo en esa llamada puntual sin
   afectar el resto de la demo. `GET /admin/metricas` (rol administrador)
   muestra el estado del circuito en vivo (`CERRADO` / `ABIERTO` /
   `SEMI_ABIERTO`), igual que el bloque "Salud de la integración con
   YAuctions" del wireframe W06.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxy configurado hacia :3000)
```

## 5. Cómo está organizado (mapeo a los módulos de openapi.yaml)

```
backend/src/
  routes/auth.routes.js         M1 · Cuentas (registro, login, refresh)
  routes/usuarios.routes.js     M1 · Cuentas (perfil y direcciones)
  routes/productos.routes.js    M2 · Catálogo
  routes/categorias.routes.js   M2 · Catálogo
  routes/pedidos.routes.js      M3 · Compras (pedidos, pago, ofertas)
  routes/webhooks.routes.js     M3 · Compras (confirmación de pago)
  routes/recomendaciones.routes.js  M4 · Recomendaciones
  routes/admin.routes.js        M5 · Administración
  adapters/YAuctionsAdapter.js  Integración externa simulada (Adapter + Circuit Breaker)
  services/                     Reglas de negocio (recomendaciones, tipo de cambio)
```

No se usó ningún ORM a propósito: todas las consultas son SQL parametrizado
explícito en cada archivo de rutas/servicios, para que el mapeo con
`schema.sql` sea trazable línea por línea durante la defensa.

## 6. Qué queda fuera de esta primera versión (a propósito)

Ver `supuestos_fase3.md` en la carpeta padre — resume cada decisión que se
asumió para poder avanzar sin bloquear el trabajo en un criterio de negocio
que el equipo todavía no ha discutido, y qué haría falta para llevarlo a
producción real (pasarela de pago real, verificación de correo, resolución
real de subastas, etc.).

## 7. Arquitectura y despliegue en AWS

A partir de la Fase 3, AWS sustituye a Microsoft Azure como plataforma de nube de referencia, conforme a la decisión ADR-07.

La solución mantiene una arquitectura de monolito modular en capas. Para la validación de la Fase 3 se dispone de un entorno reproducible mediante DOcker Compose, mientras que la arquitectura objetivo en AWS contempla servicios administrados para las etapas posteriores.

Los principales servicios previstos son:

- Amazon CloudFront y Amazon S3 para la distribución del frontend y contenido estático.
- Amazon EC2 para la ejecución del backend Node.js + Express.
- Amazon RDS for PostgreSQL como base de datos administrada.
- Amazon ElastiCache para Redis como servicio caché.
- AWS Secrets Manager para la gestión de secretos.
- Amazon CloudWatch para registros, métricas y monitoreo.

Las intrucciones de despliegue estan en `GUIA_DESPLIEGUE_AWS.md`.

Los diagramas actualizados de arquitectura se encuentran en `docs/arquitectura/` y se incluyen en formatos Draw.io, PNG y PlantUML.
