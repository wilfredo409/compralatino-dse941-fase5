# Verificación responsiva del frontend — F-1

## Alcance y dimensiones verificadas

Los viewports verificados son teléfono **375 × 667 px**, tableta
**768 × 1024 px** y computadora **1280 × 800 px**. Las capturas nuevas tienen
exactamente las dimensiones del viewport y no incluyen marco de DevTools.

Las rutas protegidas se capturaron con sesión de cliente para mis pedidos y
con rol administrador para el panel. Las capturas anteriores de esas vistas
están en `../qa/evidencias/`.

La Tabla 26 se usa como referencia para las columnas del catálogo, el diseño
de formularios y las adaptaciones por dispositivo. Los incidentes 07–10 se
implementaron y verificaron en los tres breakpoints; las capturas relacionadas
se reemplazaron por imágenes del estado corregido.

## Matriz de vistas

| Vista / ruta | Teléfono — 375 × 667 | Tableta — 768 × 1024 | Computadora — 1280 × 800 |
|---|---|---|---|
| Catálogo `/` | **Corregido** — barra inferior fija de cuatro accesos y filtros en panel desplegable. [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png) · [Filtros abiertos](../qa/evidencias/F-1_catalogo_filtros_375px.png) · [Cuenta abierta](../qa/evidencias/F-1_catalogo_cuenta_375px.png) | **Corregido** — navegación compacta desplegable y filtros colapsados al abrir. [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png) · [Menú abierto](../qa/evidencias/F-1_catalogo_menu_768px.png) · [Filtros abiertos](../qa/evidencias/F-1_catalogo_filtros_768px.png) | **Corregido** — panel lateral permanente de filtros y tres columnas. [F-1_catalogo_1280px.png](../qa/evidencias/F-1_catalogo_1280px.png) |
| Detalle `/productos/:id` | **Corregido** — la acción de compra/oferta queda fija sobre la barra inferior, sin tapar la imagen ni el contenido. [F-1_detalle_375px.png](../qa/evidencias/F-1_detalle_375px.png) | **Corregido** — imagen de prueba cargada y dimensionada para el ancho de tableta; el seed demo sigue usando placeholders. [F-1_detalle_768px.png](../qa/evidencias/F-1_detalle_768px.png) | **OK visual** — detalle e imagen visibles. [F-1_detalle_1280px.png](../qa/evidencias/F-1_detalle_1280px.png) |
| Ingreso `/ingresar` | **OK** — formulario en una columna, de acuerdo con Tabla 26. [F-1_ingreso_375px.png](../qa/evidencias/F-1_ingreso_375px.png) | **Corregido CSS** — campos dispuestos en dos columnas; revalidado a 768 px sin desbordamiento. Captura de reproducción: [F-1_ingreso_768px.png](../qa/evidencias/F-1_ingreso_768px.png). | **OK visual** — formulario accesible. [F-1_ingreso_1280px.png](../qa/evidencias/F-1_ingreso_1280px.png) |
| Registro `/registro` | **OK** — formulario en una columna, de acuerdo con Tabla 26. [F-1_registro_375px.png](../qa/evidencias/F-1_registro_375px.png) | **Corregido CSS** — campos dispuestos en dos columnas; revalidado a 768 px sin desbordamiento. Captura de reproducción: [F-1_registro_768px.png](../qa/evidencias/F-1_registro_768px.png). | **OK visual** — formulario accesible. [F-1_registro_1280px.png](../qa/evidencias/F-1_registro_1280px.png) |
| Mis pedidos `/mis-pedidos` | **Corregido CSS** — filas apiladas con etiquetas, tabla y navegación autenticada dentro del ancho emulado. Captura de reproducción: [F-1_mis-pedidos_375px.png](../qa/evidencias/F-1_mis-pedidos_375px.png). | **Corregido CSS** — las siete columnas, incluida Fecha, caben a 768 px. Captura de reproducción: [F-1_mis-pedidos_768px.png](../qa/evidencias/F-1_mis-pedidos_768px.png). | **OK visual** — tabla completa y legible. [F-1_mis-pedidos_1280px.png](../qa/evidencias/F-1_mis-pedidos_1280px.png) |
| Administración `/admin` | **Limitación conocida** — la nota de Tabla 26 excluye la optimización del panel para teléfono. [F-1_admin_375px.png](../qa/evidencias/F-1_admin_375px.png) | **Limitación conocida** — la nota de Tabla 26 excluye la optimización del panel para tableta. [F-1_admin_768px.png](../qa/evidencias/F-1_admin_768px.png) | **OK visual** — panel y tablas visibles en el tamaño para el que está optimizado. [F-1_admin_1280px.png](../qa/evidencias/F-1_admin_1280px.png) |

## Registro de bugs

### Correcciones CSS sencillas autorizadas y aplicadas

| ID | Hallazgo | Evidencia actual | Corrección y revalidación |
|---|---|---|---|
| BUG-F1-01 | Las tarjetas del catálogo no eran horizontales en teléfono. | [F-1_catalogo_375px.png](../qa/evidencias/F-1_catalogo_375px.png) | Tarjeta horizontal aplicada; revalidado a 375 px con una columna y sin overflow. **Corregido** |
| BUG-F1-02 | El catálogo mostraba tres columnas a 768 px, en vez de dos. | [F-1_catalogo_768px.png](../qa/evidencias/F-1_catalogo_768px.png) | Dos columnas aplicadas y verificadas a 768 px. **Corregido** |
| BUG-F1-03 | El catálogo mostraba cuatro columnas a 1280 px, en vez de tres. | [F-1_catalogo_1280px.png](../qa/evidencias/F-1_catalogo_1280px.png) | Tres columnas aplicadas y verificadas a 1280 px. **Corregido** |
| BUG-F1-04 | Los formularios de ingreso y registro tienen una sola columna a 768 px. | [F-1_ingreso_768px.png](../qa/evidencias/F-1_ingreso_768px.png), [F-1_registro_768px.png](../qa/evidencias/F-1_registro_768px.png) | Etiquetas y controles dispuestos en dos columnas; ambos formularios verificados a 768 px. **Corregido** |
| BUG-F1-05 | La tabla de pedidos es demasiado estrecha en teléfono, parte textos y aprieta la navegación autenticada. | [F-1_mis-pedidos_375px.png](../qa/evidencias/F-1_mis-pedidos_375px.png) | Filas en pares etiqueta/valor y navegación ajustable; verificado a 375 px sin overflow. **Corregido** |
| BUG-F1-06 | La tabla de pedidos no muestra completa la columna Fecha en tableta. | [F-1_mis-pedidos_768px.png](../qa/evidencias/F-1_mis-pedidos_768px.png) | Tabla ajustada; las siete columnas caben a 768 px sin overflow. **Corregido** |

### Incidencias funcionales restantes

| ID | Hallazgo | Evidencia actualizada | Corrección y estado |
|---|---|---|---|
| BUG-F1-07 | En móvil faltaban la barra fija de cuatro accesos y el menú lateral; en tableta faltaba el menú compacto. | [Catálogo móvil](../qa/evidencias/F-1_catalogo_375px.png) · [Cuenta móvil](../qa/evidencias/F-1_catalogo_cuenta_375px.png) · [Menú tablet](../qa/evidencias/F-1_catalogo_menu_768px.png) | Barra inferior Inicio/Filtros/Pedidos/Cuenta y menú lateral de cuenta en móvil; menú desplegable en tableta. **Corregido** |
| BUG-F1-08 | Los filtros no se desplegaban en móvil/tableta ni quedaban en un panel lateral en escritorio. | [Panel móvil](../qa/evidencias/F-1_catalogo_filtros_375px.png) · [Panel tablet](../qa/evidencias/F-1_catalogo_filtros_768px.png) · [Escritorio](../qa/evidencias/F-1_catalogo_1280px.png) | Panel inferior en móvil, colapsable en tableta y lateral permanente en escritorio. **Corregido** |
| BUG-F1-09 | La acción de compra/oferta no permanecía fija en el detalle móvil. | [Detalle móvil](../qa/evidencias/F-1_detalle_375px.png) | Barra de acción fija sobre la navegación móvil y espacio inferior para que no cubra el contenido. **Corregido** |
| BUG-F1-10 | La captura de tableta no permitía comprobar la escala de una imagen cargada porque solo mostraba el placeholder del seed. | [Detalle tablet](../qa/evidencias/F-1_detalle_768px.png) | Verificada la carga de una ilustración QA original de 800 × 600 y su render a 307 px en tableta y 320 px en móvil. El seed de demostración continúa usando placeholders y no aporta fotografías/variantes CDN. **Corregido en render responsivo; origen de imágenes reales pendiente de datos de producto** |

El panel administrativo en teléfono y tableta no se incorpora al registro de
defectos: la nota de Tabla 26 lo define como optimizado únicamente para
escritorio. Las capturas de esas dos dimensiones quedan como constancia de la
limitación conocida.

## Evidencia

Las capturas nuevas vinculadas a los bugs 07–10 se guardaron directamente con
el viewport indicado (sin marco de DevTools). Las capturas de las vistas no
afectadas conservan el formato anterior:

| Ancho emulado | Vistas |
|---|---|
| 375 × 667 px | Catálogo, catálogo con filtros, cuenta abierta, detalle móvil. |
| 768 × 1024 px | Catálogo, menú compacto, filtros, detalle con imagen cargada. |
| 1280 × 800 px | Catálogo con panel lateral de filtros. |

Las cinco capturas asociadas a los bugs 07–10 se reemplazaron; las cuatro vistas
adicionales muestran el menú de cuenta, el menú compacto y paneles desplegados. Se probaron las
interacciones y se comprobó que el ancho de desplazamiento no supera el ancho
útil del documento en 375, 768 y 1280 px. La imagen de prueba es una ilustración
SVG original usada solo para QA; no representa una fotografía del catálogo real.
