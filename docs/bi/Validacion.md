# Validación de la Solución de BI (DDL, ETL y pg_cron) - CompraLatino

- **Proyecto:** CompraLatino (Fase 3)
- **Responsable:** Edwin Cerón (Director)
- **Motor:** PostgreSQL 16
- **Fecha:** 10 de octubre de 2026
- **Rama:** `fase3/bi-validacion`
- **Revisora designada:** Laura

---

## 1. Resumen de Ejecución de Scripts

| Script | Estado | Observación |
|---|---|---|
| `bi/F1_ddl_dw.sql` | Completado con advertencia | Creación exitosa del esquema `dw`, tablas dimensionales, hechos e índices. Fallo en la sentencia final del rol `bi_reader`. |
| `seed` operacional | Exitoso | Sembrado de 5 categorías (+subcategoría), 25 productos, 5 usuarios demo + 1 admin, y 10 pedidos iniciales. |
| `bi/F2_etl.sql` | Exitoso | Poblado de la dimensión de tiempo (1,826 registros) y creación de los 5 procedimientos almacenados de carga. |
| `bi/F3_pg_cron.sql` | No compatible en Docker local | Requiere binarios y configuración de librería `pg_cron` en el contenedor. Documentado para entorno AWS RDS. |

---

## 2. Conteo de Filas del Esquema `dw`

Tras ejecutar el sembrado de datos y los procedimientos almacenados (`CALL dw.sp_cargar_dim_*` y `CALL dw.sp_cargar_fact_*`), el estado final de las tablas del esquema `dw` es:

| Esquema / Tabla | Conteo de Filas | Origen de los Datos / Detalle |
|---|---|---|
| `dw.dim_tiempo` | **1,826** | Generado automáticamente por serie temporal en `F2_etl.sql`. |
| `dw.dim_cliente` | **6** | Proveniente de `public.usuarios` (5 usuarios demo + 1 admin). |
| `dw.dim_producto` | **25** | Proveniente de `public.productos` sembrados por `seed.js`. |
| `dw.fact_ventas` | **10** | Registrado a partir del histórico de `public.pedidos` y `public.pedido_detalle`. |
| `dw.fact_recomendaciones` | **10** | Eventos/registros calculados desde `public.recomendaciones` e interacciones. |
| `dw.fact_integracion` | **0** | Sin eventos de proveedores externos registrados durante la prueba inicial de humo. |
| `dw.etl_log` | **5** | Trazas registradas por la ejecución de los 5 procedimientos almacenados del ETL. |

---

## 3. Diferencias y Hallazgos Técnicos frente a la Versión Original

### 3.1. Error de Sintaxis en Rol de Lectura (`F1_ddl_dw.sql`)
- **Problema:** La sentencia final `CREATE ROLE bi_reader LOGIN PASSWORD ':bi_reader_password';` provocó el error `syntax error at or near ":"`. Al redirigir el archivo mediante `psql < bi\F1_ddl_dw.sql`, la variable no se interpola automáticamente.
- **Acción tomada:** Se requiere ejecutar la creación definiendo la variable con `-v bi_reader_password='...'` o asignar una credencial explícita en el entorno de despliegue antes de conceder privilegios (`GRANT USAGE ON SCHEMA dw`).

### 3.2. Procedimientos Almacenados y Contexto de Esquema (`F2_etl.sql`)
- **Problema:** La invocación directa `CALL sp_cargar_dim_cliente();` produce el error `procedure does not exist` debido a que el `search_path` por defecto apunta a `public`.
- **Acción tomada:** Se debe anteponer explícitamente el esquema `dw.` (`CALL dw.sp_cargar_dim_cliente();`) o definir `SET search_path TO dw, public;` antes de la ejecución de los pipelines.

### 3.3. Disponibilidad de la Extensión `pg_cron` (`F3_pg_cron.sql`)
- **Problema:** En el contenedor local de Docker (`postgres:16`) falló con:
  ```text
  ERROR: extension "pg_cron" is not available
  DETAIL: Could not open extension control file "/usr/local/share/postgresql/extension/pg_cron.control": No such file or directory.