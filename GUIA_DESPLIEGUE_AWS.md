# Instalación y mantenimiento de CompraLatino

## Destino de referencia

AWS us-east-1, EC2 Linux t3.small con EBS gp3 de 20 GiB para el piloto. Docker Compose ejecuta nginx y la SPA Vue, el backend Express y PostgreSQL 16. El proxy nginx del host termina HTTPS y reenvía al puerto 8080 de la interfaz local. PostgreSQL y Express se alcanzan solo desde la red Docker. La Fase 4 presupuestó un escenario administrado con RDS, CloudFront y otros servicios. Ese diseño es una opción de evolución que requiere su propia validación.

### Instalación

1. Prepara el host con Docker Engine, Compose v2, nginx, un dominio y certificado emitido para ese dominio. Define alertas de gasto y acceso de operador con MFA. En el grupo de seguridad abre 443, 80 para redirección y 22 únicamente al origen administrativo. Usa un usuario de operación separado.
2. Retira cualquier versión anterior del puerto 8080 antes de desplegar una segunda instalación. Copia el repositorio desde GitHub con acceso autorizado y fija la versión por commit o etiqueta. Copia `.env.example` a `.env`, restringe permisos con `chmod 600 .env` y asigna valores hexadecimales aleatorios e independientes con `openssl rand -hex 32`. Conserva los secretos fuera de Git.
3. Ejecuta `docker compose up -d --build --wait`. Comprueba `docker compose ps`. Para una base existente, registra qué scripts de `deploy/db-init` ya se aplicaron y aplica solamente los pendientes, con respaldo previo y `ON_ERROR_STOP=1`. Para crear datos de demostración ejecuta `docker compose exec backend npm run seed` únicamente en un ambiente aislado.
4. Configura `COMPRALATINO_HOST` con el dominio real y genera la configuración del host con `envsubst '${COMPRALATINO_HOST}' < deploy/nginx/compralatino.conf.template`. Instálala en la configuración de nginx del host, valida con `nginx -t` y recarga. El certificado debe existir antes de activar este archivo. Mantén `WEB_PORT=8080` o ajusta el destino del proxy.
5. Prueba la redirección y verifica HTTPS con `curl --fail --tlsv1.3 --tls-max 1.3 https://DOMINIO/api/v1/salud/listo`. Confirma la renovación del certificado. Recorre el flujo con datos sintéticos, revisa Swagger, exporta CSV como administrador y registra UTC, versión, resultado, operador y URL.
6. Habilita [el ETL](docs/bi/operacion.md) y conserva su salida en la bitácora. Revisa que el respaldo pueda restaurarse en una base separada. Una persona distinta del operador debe revisar la evidencia antes de promover la versión.

### Actualización del catálogo académico

Para actualizar una base de demostración existente, registra la versión anterior, respalda y reconstruye los servicios desde el commit revisado. Luego ejecuta `docker compose exec backend npm run catalogo:demo`. El proceso actualiza las fichas de demostración por su referencia, agrega las nuevas y conserva los identificadores y el inventario existente. La ejecución repetida deja el mismo surtido. En una base de demostración vacía basta con ejecutar `npm run seed`.

Comprueba que se sirven las imágenes, revisa el desglose de una compra directa y la ficha de una subasta, y ejecuta el [humo de navegador](pruebas/README.md). Corre y concilia el ETL para que las nuevas referencias estén disponibles en el almacén dimensional.

### Respaldo y restauración

En el servidor Linux crea un directorio de respaldos fuera del repositorio, con permisos para el operador. Programa al menos un respaldo diario y guarda una copia cifrada fuera del host. RPO propuesto: 24 horas. RTO propuesto: 4 horas. Conserva 7 diarios y 4 semanales conforme a la política de datos del entorno.

```sh
umask 077
marca=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db pg_dump -Fc -U compralatino -d compralatino > "/ruta/respaldos/CL-${marca}.dump"
test -s "/ruta/respaldos/CL-${marca}.dump"
docker compose exec -T db createdb -U compralatino compralatino_restore
docker compose exec -T db pg_restore --exit-on-error -U compralatino -d compralatino_restore < "/ruta/respaldos/CL-${marca}.dump"
```

Comprueba restauración, integridad y permisos en una base con nombre nuevo. Restablece roles de lectura con privilegios mínimos si cambias de clúster. Prueba la aplicación después de apuntar una instancia aislada a la copia restaurada. Para recuperar producción, valida la copia antes de promoverla y documenta el intervalo de transacciones afectado.

### Versiones, parches e incidencias

- **Cada día**. Revisa disponibilidad, fallos del ETL, edad del último respaldo y capacidad de disco.
- **Cada semana**. Revisa dependencias, certificados y errores recurrentes. Verifica una restauración fuera de producción y da seguimiento a los incidentes en Trello.
- **Cada mes**. Agrupa parches compatibles, aplica al ambiente de prueba y revisa consumo, accesos, indicadores y compromisos. Prueba de nuevo después de promover.
- **Incidente crítico**. Registra versión, hora y síntomas. Un fallo de disponibilidad o integridad detiene la promoción. Si el último cambio es la causa, vuelve a construir desde la versión aprobada anterior con `docker compose up -d --build --wait`. Conserva el volumen. Si los datos sufrieron un cambio incompatible, restaura la copia verificada en una base separada y aplica el procedimiento de recuperación.
- **Parche de emergencia**. Revisa el cambio con otro integrante, ejecuta las pruebas pertinentes, registra el respaldo y repite la prueba de humo. Usa etiquetas Git para identificar liberaciones y evita ramas o artefactos sin revisión.

Esta distribución sirve para la validación académica o un piloto sin operaciones comerciales reales. Liberar a usuarios finales requiere autorización del propietario, dominio y certificado, credenciales y contrato de YAuctions, pasarela aprobada, controles sobre datos personales y aceptación funcional y operativa. El tramo interno del proxy a los contenedores usa HTTP sobre el host y la red privada. Para exigir TLS en cada tramo hay que configurar y verificar también ese cifrado interno.
