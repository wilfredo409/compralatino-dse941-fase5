# Operación del almacén de datos

CompraLatino mantiene el esquema operacional `public` y el esquema dimensional `dw` en PostgreSQL. El ETL carga dimensiones de fecha, cliente y producto, y hechos de ventas, integración y recomendaciones. El cuadro de mando web consulta pedidos operativos autorizados. Los informes históricos de Power BI consumen el almacén.

## Arranque y repetición

Con los datos operativos inicializados, ejecuta en orden desde la raíz como propietario de la base. En Linux con Compose:

```sh
docker compose exec -T db psql -U compralatino -d compralatino -v ON_ERROR_STOP=1 < bi/F1_ddl_dw.sql
docker compose exec -T db psql -U compralatino -d compralatino -v ON_ERROR_STOP=1 < bi/F2_etl.sql
docker compose exec -T db psql -U compralatino -d compralatino -v ON_ERROR_STOP=1 < bi/ejecutar_etl.sql
```

Aplica F1 una sola vez por base. Reaplica F2 al actualizar las definiciones. Programa `ejecutar_etl.sql` diariamente a las 02:00 UTC mediante el planificador del host y registra salida y código de retorno. En RDS con la extensión habilitada, usa la ruta documentada en `bi/F3_pg_cron.sql` después de confirmar el nombre de la base. Las llamadas se ejecutan dentro de una transacción y un bloqueo asesor impide superponer corridas del mismo archivo. El registro del proceso exterior conserva el error si la transacción se revierte.

```sql
SELECT proceso, fecha_fin, filas_procesadas, estado
FROM dw.etl_log ORDER BY id_corrida DESC LIMIT 5;
```

La carga de ventas reconcilia estados actuales, agrupa líneas repetidas y conserva los importes de las cabeceras, también cuando el subtotal es cero. La tabla de integración solo recibe pujas persistidas por la API. El tablero operativo muestra fallos del adaptador en memoria, mientras el almacén tiene alcance histórico sobre los eventos que efectivamente se persistieron.

## Conexión para Power BI

Crea y administra una identidad de lectura por ambiente, con acceso de red restringido. F1 deja el rol agrupador `bi_reader` sin inicio de sesión. Crea un usuario separado de BI, concede `bi_reader` a ese usuario y asigna su contraseña por el mecanismo autorizado. El usuario lector consulta tablas del esquema `dw` y conserva permisos separados de la API. Evita publicar datos identificables en las páginas de dirección.

En Power BI conecta a PostgreSQL e importa las dimensiones y hechos para relacionar las claves respectivas. Usa las medidas de `bi/F4_medidas.dax` en las páginas Ventas, Integración, Recomendaciones y Vista ejecutiva de la Fase 3. Programa la actualización después del ETL y valida totales, segmentación, permisos y licencias en el entorno de destino.