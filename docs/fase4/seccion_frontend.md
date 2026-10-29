# Verificación responsiva del frontend — F-1

## Alcance y dimensiones verificadas

La dimensión de prueba es la que aparece en la barra superior de cada captura
de DevTools:
teléfono **375 × 667 px**, tableta **768 × 1024 px** y computadora
**1280 × 800 px**. El tamaño total del PNG incluye el marco de DevTools y no
se usa como dimensión del viewport emulado.

Las rutas protegidas se capturaron con sesión de cliente para mis pedidos y
con rol administrador para el panel. Las capturas son de página completa donde
aplica y están en `../qa/evidencias/`.

La Tabla 26 se usa como referencia para las columnas del catálogo, el diseño
de formularios y las adaptaciones por dispositivo. Las capturas guardadas
documentan la reproducción inicial de los defectos. Tras la autorización se
aplicaron los seis ajustes CSS sencillos y se revalidaron sus breakpoints en la
aplicación: columnas del catálogo, formularios de tableta y tabla/navegación de
pedidos. No se reemplazaron las capturas de reproducción.

Los incidentes pendientes de navegación/interacción/estructura serán
manejados en la rama `fase4/fix-incidente`.

## Matriz de vistas

| Vista / ruta | Teléfono — 375 × 667 | Tableta — 768 × 1024 | Computadora — 1280 × 800 |
|---|---|---|---|
| Catálogo `/` | **Corregido CSS** — una columna con tarjeta horizontal; revalidado a 375 px sin desbordamiento. La barra inferior fija y los filtros desplegables siguen pendientes. Captura de reproducción: [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png). | **Corregido CSS** — dos columnas revalidadas a 768 px. Filtros colapsables y menú compacto siguen pendientes. Captura de reproducción: [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png). | **Corregido CSS** — tres columnas revalidadas a 1280 px. El panel de filtros lateral y el buscador expandido siguen pendientes. Captura de reproducción: [F-1_catalogo_1280px.png](../qa/evidencias/F-1_catalogo_1280px.png). |
| Detalle `/productos/:id` | **Pendiente de ajuste funcional** — el acceso para continuar aparece en el flujo del contenido y no permanece fijo. [F-1_detalle_375px.png](../qa/evidencias/F-1_detalle_375px.png) | **Pendiente de verificación de imagen** — la captura muestra el recurso placeholder y no permite comprobar una imagen servida en resolución intermedia. [F-1_detalle_768px.png](../qa/evidencias/F-1_detalle_768px.png) | **OK visual** — detalle e imagen visibles, sin defecto apreciable en la captura. [F-1_detalle_1280px.png](../qa/evidencias/F-1_detalle_1280px.png) |
| Ingreso `/ingresar` | **OK** — formulario en una columna, de acuerdo con Tabla 26. [F-1_ingreso_375px.png](../qa/evidencias/F-1_ingreso_375px.png) | **Corregido CSS** — campos dispuestos en dos columnas; revalidado a 768 px sin desbordamiento. Captura de reproducción: [F-1_ingreso_768px.png](../qa/evidencias/F-1_ingreso_768px.png). | **OK visual** — formulario accesible. [F-1_ingreso_1280px.png](../qa/evidencias/F-1_ingreso_1280px.png) |
| Registro `/registro` | **OK** — formulario en una columna, de acuerdo con Tabla 26. [F-1_registro_375px.png](../qa/evidencias/F-1_registro_375px.png) | **Corregido CSS** — campos dispuestos en dos columnas; revalidado a 768 px sin desbordamiento. Captura de reproducción: [F-1_registro_768px.png](../qa/evidencias/F-1_registro_768px.png). | **OK visual** — formulario accesible. [F-1_registro_1280px.png](../qa/evidencias/F-1_registro_1280px.png) |
| Mis pedidos `/mis-pedidos` | **Corregido CSS** — filas apiladas con etiquetas, tabla y navegación autenticada dentro del ancho emulado. Captura de reproducción: [F-1_mis-pedidos_375px.png](../qa/evidencias/F-1_mis-pedidos_375px.png). | **Corregido CSS** — las siete columnas, incluida Fecha, caben a 768 px. Captura de reproducción: [F-1_mis-pedidos_768px.png](../qa/evidencias/F-1_mis-pedidos_768px.png). | **OK visual** — tabla completa y legible. [F-1_mis-pedidos_1280px.png](../qa/evidencias/F-1_mis-pedidos_1280px.png) |
| Administración `/admin` | **Limitación conocida** — la nota de Tabla 26 excluye la optimización del panel para teléfono. [F-1_admin_375px.png](../qa/evidencias/F-1_admin_375px.png) | **Limitación conocida** — la nota de Tabla 26 excluye la optimización del panel para tableta. [F-1_admin_768px.png](../qa/evidencias/F-1_admin_768px.png) | **OK visual** — panel y tablas visibles en el tamaño para el que está optimizado. [F-1_admin_1280px.png](../qa/evidencias/F-1_admin_1280px.png) |

## Registro de bugs

### Correcciones CSS sencillas autorizadas y aplicadas

| ID | Hallazgo inicial | Captura(s) de reproducción | Corrección y revalidación |
|---|---|---|---|
| BUG-F1-01 | Las tarjetas del catálogo no son horizontales en teléfono. | [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png) | Tarjeta horizontal aplicada; revalidado a 375 px con una columna y sin overflow. **Corregido** |
| BUG-F1-02 | El catálogo muestra tres columnas a 768 px, en vez de dos. | [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png) | Dos columnas aplicadas y verificadas a 768 px. **Corregido** |
| BUG-F1-03 | El catálogo muestra cuatro columnas a 1280 px, en vez de tres. | [F-1_catalogo_1280px.png](../qa/evidencias/F-1_catalogo_1280px.png) | Tres columnas aplicadas y verificadas a 1280 px. **Corregido** |
| BUG-F1-04 | Los formularios de ingreso y registro tienen una sola columna a 768 px. | [F-1_ingreso_768px.png](../qa/evidencias/F-1_ingreso_768px.png), [F-1_registro_768px.png](../qa/evidencias/F-1_registro_768px.png) | Etiquetas y controles dispuestos en dos columnas; ambos formularios verificados a 768 px. **Corregido** |
| BUG-F1-05 | La tabla de pedidos es demasiado estrecha en teléfono, parte textos y aprieta la navegación autenticada. | [F-1_mis-pedidos_375px.png](../qa/evidencias/F-1_mis-pedidos_375px.png) | Filas en pares etiqueta/valor y navegación ajustable; verificado a 375 px sin overflow. **Corregido** |
| BUG-F1-06 | La tabla de pedidos no muestra completa la columna Fecha en tableta. | [F-1_mis-pedidos_768px.png](../qa/evidencias/F-1_mis-pedidos_768px.png) | Tabla ajustada; las siete columnas caben a 768 px sin overflow. **Corregido** |

### Pendientes que no son un ajuste CSS sencillo

| ID | Hallazgo | Capturas que lo evidencian | Pendiente |
|---|---|---|---|
| BUG-F1-07 | La navegación móvil no usa barra inferior fija de cuatro accesos ni menú lateral; en tableta no usa barra compacta con menú desplegable. | [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png), [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png) | Cambiar estructura e interacción de navegación. |
| BUG-F1-08 | Los filtros no se despliegan en un panel en teléfono ni permanecen colapsados en tableta; en computadora no forman un panel lateral permanente. | [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png), [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png), [F-1_catalogo_1280px.png](../qa/evidencias/F-1_catalogo_1280px.png) | Añadir interacción de desplegar/colapsar y reestructurar la distribución del catálogo. |
| BUG-F1-09 | El acceso de compra/oferta del detalle móvil no permanece fijo. | [F-1_detalle_375px.png](../qa/evidencias/F-1_detalle_375px.png) | Definir un bloque fijo de acción que no cubra los datos del producto ni los controles. |
| OBS-F1-10 | Las capturas de tableta muestran placeholders, así que no permiten verificar la variante de imagen intermedia requerida. No es un defecto confirmado por esta evidencia. | [F-1_detalle_768px.png](../qa/evidencias/F-1_detalle_768px.png), [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png) | Validar la disponibilidad de imágenes y confirmar el requisito con un producto que tenga imagen real. |

El panel administrativo en teléfono y tableta no se incorpora al registro de
defectos: la nota de Tabla 26 lo define como optimizado únicamente para
escritorio. Las capturas de esas dos dimensiones quedan como constancia de la
limitación conocida.

## Evidencia

Las 18 capturas conservan en su encabezado de DevTools el viewport emulado.
Su resolución de archivo incluye también el marco del navegador; para comprobar
el breakpoint se tomó la lectura “Dimensiones” de cada captura:

| Ancho emulado | Vistas |
|---|---|
| 375 × 667 px | Catálogo, detalle, ingreso, registro, mis pedidos y administración. |
| 768 × 1024 px | Catálogo, detalle, ingreso, registro, mis pedidos y administración. |
| 1280 × 800 px | Catálogo, detalle, ingreso, registro, mis pedidos y administración. |

Las capturas de reproducción se conservan sin cambios para documentar los
defectos iniciales. La compilación de producción del frontend pasó y las
mediciones posteriores confirmaron las columnas esperadas, el ajuste de los
formularios y la ausencia de desplazamiento horizontal en las combinaciones
revalidadas.
