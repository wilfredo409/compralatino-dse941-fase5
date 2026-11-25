import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const [emailCliente, claveCliente, emailAdmin, claveAdmin] = [
  'SMOKE_CLIENT_EMAIL', 'SMOKE_CLIENT_PASSWORD', 'SMOKE_ADMIN_EMAIL', 'SMOKE_ADMIN_PASSWORD',
].map((clave) => {
  if (!process.env[clave]) throw new Error('Falta configurar ' + clave);
  return process.env[clave];
});

const navegador = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
pagina.setDefaultTimeout(8000);
const errores = [];
pagina.on('pageerror', (error) => errores.push(error.message));
const capturas = process.env.SMOKE_CAPTURE_DIR;
if (capturas) await mkdir(capturas, { recursive: true });

let pasoActual;
let total = 0;
async function paso(nombre, ejecutar) {
  pasoActual = nombre;
  await ejecutar();
  total += 1;
  console.log('OK - ' + nombre);
}

async function abrir(ruta) {
  await pagina.goto(base + ruta);
}

async function entrar(email, clave) {
  await abrir('/ingresar');
  const formulario = pagina.locator('.auth-form form');
  await formulario.getByLabel('Correo electrónico').fill(email);
  await formulario.getByLabel('Contraseña').fill(clave);
  await formulario.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await pagina.waitForURL((url) => url.pathname === '/');
}

async function buscar(texto) {
  const buscador = pagina.getByRole('searchbox', { name: 'Buscar en el catálogo' });
  await buscador.fill(texto);
  await pagina.getByRole('button', { name: 'Buscar', exact: true }).first().click();
}

async function sinDesbordamiento(ancho) {
  await pagina.setViewportSize({ width: ancho, height: 900 });
  const dimensiones = await pagina.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(dimensiones[0] <= dimensiones[1] + 1, 'Desbordamiento en ' + ancho + ' px');
}

try {
  await paso('catálogo público y fotos únicas para cada ficha', async () => {
    await abrir('/');
    await pagina.getByRole('heading', { name: /Descubre Japón/ }).waitFor();
    await pagina.locator('#resultados .producto-card').first().waitFor();
    const respuesta = await pagina.request.get(base + '/api/v1/productos?limite=100');
    assert.ok(respuesta.ok());
    const { items } = await respuesta.json();
    assert.ok(items.length >= 36);
    const fotos = items.filter((p) => p.idExternoYa.startsWith('DEMO-JP-')).map((p) => p.imagenes[0]);
    assert.equal(fotos.length, 36);
    assert.equal(new Set(fotos).size, 36);
    for (const foto of fotos) {
      assert.match(foto, /^\/catalogo\/[\w-]+\.webp$/);
      const img = await pagina.request.get(base + foto);
      assert.ok(img.ok() && img.headers()['content-type']?.includes('image/webp'), foto);
    }
    if (capturas) await pagina.screenshot({ path: join(capturas, 'tienda.png') });
  });

  await paso('búsqueda vacía y restauración del catálogo', async () => {
    await buscar('sin-coincidencias-compralatino');
    await pagina.getByRole('heading', { name: 'No hay productos que coincidan con los filtros.' }).waitFor();
    await pagina.getByRole('link', { name: 'Ver todo el catálogo' }).click();
    await pagina.locator('#resultados .producto-card').first().waitFor();
  });

  await paso('categorías y paginación conservan el contexto', async () => {
    const conteo = await pagina.locator('#resultados .producto-card').count();
    await pagina.getByRole('button', { name: 'Ver más productos' }).click();
    await pagina.waitForFunction((n) => document.querySelectorAll('#resultados .producto-card').length > n, conteo);
    await pagina.getByRole('link', { name: 'Papelería', exact: true }).click();
    await pagina.waitForURL((url) => url.searchParams.has('categoria'));
    await pagina.locator('#resultados .producto-card').first().waitFor();
    const titulos = await pagina.locator('#resultados .producto-card h3').allTextContents();
    assert.ok(titulos.some((titulo) => titulo.includes('Midori')));
  });

  await paso('pujas y compra directa se distinguen en fichas y filtros', async () => {
    await pagina.getByRole('navigation', { name: 'Tienda' }).getByRole('link', { name: 'Subastas' }).click();
    await pagina.locator('#resultados .producto-card').first().click();
    await pagina.getByRole('link', { name: 'Ingresar para pujar' }).waitFor();
    await pagina.getByRole('heading', { name: 'Detalles del artículo' }).waitFor();
    await pagina.getByRole('navigation', { name: 'Tienda' }).getByRole('link', { name: 'Compra directa' }).click();
    await pagina.locator('#resultados .producto-card').first().click();
    await pagina.getByText('Total en USD', { exact: true }).waitFor();
    await pagina.getByRole('link', { name: 'Ingresar para comprar' }).waitFor();
    if (capturas) await pagina.screenshot({ path: join(capturas, 'ficha.png') });
  });

  await paso('protección de pedidos y retorno a la ficha desde ingreso', async () => {
    const ficha = new URL(pagina.url()).pathname;
    await pagina.getByRole('link', { name: 'Ingresar para comprar' }).click();
    assert.equal(new URL(pagina.url()).searchParams.get('redirigirA'), ficha);
    await abrir('/mis-pedidos');
    await pagina.waitForURL((url) => url.pathname === '/ingresar' && url.searchParams.get('redirigirA') === '/mis-pedidos');
  });

  await paso('credenciales inválidas se explican en el formulario', async () => {
    await pagina.getByLabel('Correo electrónico').fill('smoke-no-existe@invalid.example');
    await pagina.getByLabel('Contraseña').fill('NoValida!123');
    await pagina.locator('.auth-form').getByRole('button', { name: 'Ingresar' }).click();
    await pagina.getByRole('alert').waitFor();
  });

  await paso('artículo inexistente muestra un estado de error', async () => {
    await abrir('/productos/00000000-0000-4000-8000-000000000000');
    await pagina.getByRole('heading', { name: 'Producto no encontrado' }).waitFor();
  });

  await paso('cliente tiene recomendaciones y administración restringida', async () => {
    await entrar(emailCliente, claveCliente);
    await pagina.getByRole('heading', { name: 'Recomendado para ti' }).waitFor();
    await abrir('/admin');
    await pagina.getByRole('heading', { name: 'Acceso restringido' }).waitFor();
  });

  await paso('cliente consulta datos y direcciones', async () => {
    await abrir('/cuenta');
    await pagina.getByRole('heading', { name: 'Direcciones' }).waitFor();
    const nombre = await pagina.getByLabel('Nombre', { exact: true }).inputValue();
    assert.ok(nombre);
    await pagina.getByRole('button', { name: 'Guardar datos' }).click();
    await pagina.getByText('Perfil actualizado.').waitFor();
  });

  await paso('compra directa con desglose y pedido registrado', async () => {
    await abrir('/?tipoVenta=fijo#resultados');
    await pagina.locator('#resultados .producto-card').first().click();
    await pagina.getByRole('button', { name: 'Comprar ahora' }).click();
    await pagina.getByText(/Compra confirmada/).waitFor();
    await pagina.getByRole('link', { name: 'Ver mis pedidos', exact: true }).click();
    await pagina.locator('.pedidos-lista .pedido').first().waitFor();
  });

  await paso('subasta local con puja en yenes', async () => {
    await abrir('/?tipoVenta=subasta#resultados');
    await pagina.locator('#resultados .producto-card').first().click();
    await pagina.getByLabel('Tu puja en JPY').waitFor();
    await pagina.getByRole('button', { name: 'Pujar en YAuctions' }).click();
    await pagina.getByText(/Puja registrada/).waitFor();
  });

  await paso('tienda y filtros utilizables en escritorio, tableta y móvil', async () => {
    await abrir('/');
    await pagina.locator('#resultados .producto-card').first().waitFor();
    for (const ancho of [1440, 768, 375]) await sinDesbordamiento(ancho);
    await pagina.getByRole('button', { name: 'Filtros', exact: true }).click();
    await pagina.getByLabel('Categoría', { exact: true }).waitFor();
    await pagina.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: 'Buscar' }).click();
    assert.equal(await pagina.getByRole('searchbox').evaluate((campo) => campo === document.activeElement), true);
    if (capturas) await pagina.screenshot({ path: join(capturas, 'tienda-movil.png') });
    await pagina.setViewportSize({ width: 1440, height: 900 });
  });

  await paso('administración con resumen ejecutivo y filtro de periodo', async () => {
    await abrir('/cuenta');
    await pagina.getByRole('button', { name: 'Salir' }).click();
    await entrar(emailAdmin, claveAdmin);
    await abrir('/admin');
    const cuadro = pagina.getByRole('region', { name: 'Cuadro de mando ejecutivo' });
    await cuadro.getByRole('table').waitFor();
    await cuadro.getByLabel('Periodo de análisis').selectOption('7');
    await cuadro.getByRole('table').waitFor();
    if (capturas) await pagina.screenshot({ path: join(capturas, 'administracion.png') });
  });

  await paso('administración abre pedidos, usuarios y auditoría desde el menú', async () => {
    const menu = pagina.getByRole('navigation', { name: 'Administración', exact: true });
    await menu.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await pagina.getByLabel('Estado del pedido').selectOption('pagado');
    await pagina.locator('.admin-principal table').waitFor();
    await menu.getByRole('link', { name: 'Usuarios' }).click();
    await pagina.getByRole('combobox', { name: 'Estado de ' + emailCliente }).waitFor();
    await menu.getByRole('link', { name: 'Auditoría' }).click();
    await pagina.getByRole('heading', { name: 'Auditoría', exact: true }).waitFor();
    for (const ancho of [1440, 768, 375]) await sinDesbordamiento(ancho);
  });

  await paso('exportación autenticada del CSV', async () => {
    await pagina.getByRole('navigation', { name: 'Administración', exact: true }).getByRole('link', { name: 'Reportes' }).click();
    const [archivo] = await Promise.all([
      pagina.waitForEvent('download'),
      pagina.getByRole('button', { name: 'Exportar transacciones (CSV)' }).click(),
    ]);
    assert.equal(archivo.suggestedFilename(), 'transacciones.csv');
    assert.equal(await archivo.failure(), null);
  });

  await paso('sin errores JavaScript durante las pruebas', async () => assert.deepEqual(errores, []));
  console.log('RESULTADO: ' + total + ' pasos aprobados');
} catch (error) {
  await pagina.screenshot({ path: join(capturas || tmpdir(), 'compralatino-error.png'), fullPage: true }).catch(() => {});
  console.error('FAIL - ' + pasoActual + ': ' + error.message);
  process.exitCode = 1;
} finally {
  await navegador.close();
}
