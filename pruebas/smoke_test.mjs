import { chromium } from 'playwright';
import os from 'os';
import path from 'path';

// Uso: node smoke_test.mjs   (con backend en :3000 y frontend en :5173 corriendo y la BD sembrada)
// Si Playwright no encuentra su navegador: npx playwright install chromium
// Para usar un Chromium propio: CHROMIUM_PATH=/ruta/al/chromium node smoke_test.mjs
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const CAPTURAS = os.tmpdir();
const CLIENTE_EMAIL = process.env.SMOKE_CLIENT_EMAIL;
const CLIENTE_PASSWORD = process.env.SMOKE_CLIENT_PASSWORD;
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;

for (const [nombre, valor] of Object.entries({
  SMOKE_CLIENT_EMAIL: CLIENTE_EMAIL,
  SMOKE_CLIENT_PASSWORD: CLIENTE_PASSWORD,
  SMOKE_ADMIN_EMAIL: ADMIN_EMAIL,
  SMOKE_ADMIN_PASSWORD: ADMIN_PASSWORD,
})) {
  if (!valor) throw new Error(`Falta configurar la variable de entorno ${nombre}`);
}

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
const page = await browser.newPage();
const errores = [];
const respuestasHttpEsperadas = new Map();
page.on('pageerror', (e) => errores.push(String(e)));
page.on('response', (response) => {
  const ruta = new URL(response.url()).pathname;
  const estado = response.status();
  const esperada = (estado === 401 && ruta === '/api/v1/auth/login')
    || (estado === 403 && ruta === '/api/v1/admin/metricas')
    || (estado === 404 && ruta === '/api/v1/productos/00000000-0000-4000-8000-000000000000');
  if (esperada) respuestasHttpEsperadas.set(estado, (respuestasHttpEsperadas.get(estado) || 0) + 1);
});
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const estado = Number(msg.text().match(/status of (\d{3})/)?.[1]);
  const cantidad = respuestasHttpEsperadas.get(estado) || 0;
  if (cantidad) {
    respuestasHttpEsperadas.set(estado, cantidad - 1);
    return;
  }
  errores.push(msg.text());
});

await page.route('**://*.google.com/**', (route) => route.abort());
await page.route('**://*.googleapis.com/**', (route) => route.abort());

let pasoIdx = 0;
async function paso(nombre, fn) {
  pasoIdx++;
  try {
    await fn();
    console.log(`OK   - ${nombre}`);
  } catch (e) {
    console.log(`FAIL - ${nombre}: ${e.message}`);
    await page.screenshot({ path: `${path.join(CAPTURAS, 'fallo_' + pasoIdx + '.png')}`, fullPage: true }).catch(() => {});
    console.log(`  (captura: ${path.join(CAPTURAS, 'fallo_' + pasoIdx + '.png')}, url actual: ${page.url()})`);
    process.exitCode = 1;
  }
}

await paso('cargar catálogo (home)', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.tarjeta', { timeout: 5000 });
});

await paso('ruta protegida sin sesión redirige a ingresar', async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/mis-pedidos', { waitUntil: 'networkidle' });
  await page.waitForURL('**/ingresar**', { timeout: 5000 });
  const destino = new URL(page.url()).searchParams.get('redirigirA');
  if (destino !== '/mis-pedidos') throw new Error(`destino de redirección inesperado: ${destino}`);
});

await paso('login con credenciales inválidas muestra error', async () => {
  await page.fill('input[type=email]', `smoke-invalido-${Date.now()}@invalid.example`);
  await page.fill('input[type=password]', 'NoEsUnaClaveValida-123');
  await page.click('button:has-text("Ingresar")');
  const error = page.locator('.alerta.error');
  await error.waitFor({ state: 'visible', timeout: 5000 });
  if (!(await error.innerText()).trim()) throw new Error('el mensaje de error está vacío');
});

await paso('búsqueda sin resultados muestra estado vacío', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.fill('.filtros input', `smoke-sin-resultados-${Date.now()}`);
  await page.waitForSelector('text=No hay productos que coincidan con los filtros.', { timeout: 5000 });
});

await paso('producto inexistente muestra mensaje', async () => {
  await page.goto(BASE + '/productos/00000000-0000-4000-8000-000000000000', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Producto no encontrado', { timeout: 5000 });
});

await paso('login como cliente demo', async () => {
  await page.goto(BASE + '/ingresar', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', CLIENTE_EMAIL);
  await page.fill('input[type=password]', CLIENTE_PASSWORD);
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('text=Recomendado para ti', { timeout: 5000 });
});

await paso('cliente no accede a /admin', async () => {
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Tu cuenta no tiene el rol de administrador', { timeout: 5000 });
  if (await page.locator('.kpi').count()) throw new Error('se mostraron métricas administrativas a un cliente');
});

await paso('ver recomendaciones con motivo', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Recomendado para ti', { timeout: 5000 });
  const motivo = await page.textContent('.rejilla >> nth=0 >> .. >> div >> nth=-1');
  if (!motivo) throw new Error('no se encontró texto de motivo de recomendación');
});

await paso('abrir detalle de un producto de compra directa y comprarlo', async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // Filtrar por compra directa para asegurar un producto "fijo"
  await page.selectOption('.filtros select >> nth=1', 'fijo');
  await page.waitForTimeout(500);
  await page.click('.rejilla .tarjeta >> nth=0');
  await page.waitForSelector('button:has-text("Comprar ahora"), .form');
  if (await page.locator('.form').count() > 0) {
    await page.fill('.form input >> nth=1', 'San Salvador');
    await page.fill('.form input >> nth=2', 'San Salvador');
    await page.fill('.form input >> nth=3', 'Calle demo Playwright #1');
    await page.click('button:has-text("Guardar dirección")');
    await page.waitForSelector('button:has-text("Comprar ahora")');
  }
  await page.click('button:has-text("Comprar ahora")');
  await page.waitForSelector('text=Compra confirmada', { timeout: 5000 });
});

await paso('ver el pedido reflejado en Mis pedidos', async () => {
  await page.waitForURL('**/mis-pedidos', { timeout: 3000 });
  await page.waitForSelector('table tr');
});

await paso('cerrar sesión y entrar como admin', async () => {
  await page.click('text=Salir');
  await page.click('text=Ingresar');
  await page.fill('input[type=email]', ADMIN_EMAIL);
  await page.fill('input[type=password]', ADMIN_PASSWORD);
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('.tarjeta', { timeout: 5000 });
});

await paso('ver panel administrativo con métricas', async () => {
  await page.click('text=Administración');
  await page.waitForSelector('.kpi', { timeout: 5000 });
  const texto = await page.textContent('body');
  if (!texto.includes('Salud de la integración con YAuctions')) throw new Error('no se ve el bloque de salud de YAuctions');
});

await paso('comparar indicadores ejecutivos en escritorio, tableta y teléfono', async () => {
  const cuadro = page.getByRole('region', { name: 'Cuadro de mando ejecutivo' });
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await cuadro.getByRole('table').waitFor();
    if (await cuadro.evaluate((el) => el.scrollWidth > el.clientWidth + 1)) {
      throw new Error(`desbordamiento del cuadro ejecutivo a ${width} px`);
    }
  }
  const [resultado] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/admin/cuadro-mando?dias=7')),
    cuadro.getByLabel('Periodo de análisis').selectOption('7'),
  ]);
  if (!resultado.ok() || (await resultado.json()).dias !== 7) throw new Error('no se aplicó el filtro de periodo');
  await cuadro.getByRole('table').waitFor();
  await cuadro.getByRole('slider').press('ArrowRight');
  if (!(await cuadro.innerText()).includes('5 %')) throw new Error('el escenario no refleja la variación');
});

await paso('exportar el reporte de transacciones con la sesión de administrador', async () => {
  const [archivo] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exportar reporte/ }).click(),
  ]);
  if (archivo.suggestedFilename() !== 'transacciones.csv' || await archivo.failure()) {
    throw new Error('no se descargó el CSV esperado');
  }
});

if (errores.length) {
  console.log('--- Errores de consola/página detectados ---');
  console.log(errores.join('\n'));
  process.exitCode = 1;
}

await browser.close();
console.log(process.exitCode ? '\nRESULTADO: FALLÓ' : '\nRESULTADO: TODO OK');
