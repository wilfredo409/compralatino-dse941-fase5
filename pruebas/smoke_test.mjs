import { chromium } from 'playwright';
import os from 'os';
import path from 'path';

// Uso: node smoke_test.mjs   (con backend en :3000 y frontend en :5173 corriendo y la BD sembrada)
// Si Playwright no encuentra su navegador: npx playwright install chromium
// Para usar un Chromium propio: CHROMIUM_PATH=/ruta/al/chromium node smoke_test.mjs
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const CAPTURAS = os.tmpdir();

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
const page = await browser.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errores.push(msg.text()); });

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

await paso('login como cliente demo', async () => {
  await page.click('text=Ingresar');
  await page.fill('input[type=email]', 'laura.pineda@demo.compralatino.com');
  await page.fill('input[type=password]', 'Demo1234!');
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('text=Recomendado para ti', { timeout: 5000 });
});

await paso('ver recomendaciones con motivo', async () => {
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
  await page.fill('input[type=email]', 'admin@compralatino.com');
  await page.fill('input[type=password]', 'Admin1234!');
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('.tarjeta', { timeout: 5000 });
});

await paso('ver panel administrativo con métricas', async () => {
  await page.click('text=Administración');
  await page.waitForSelector('.kpi', { timeout: 5000 });
  const texto = await page.textContent('body');
  if (!texto.includes('Salud de la integración con YAuctions')) throw new Error('no se ve el bloque de salud de YAuctions');
});

if (errores.length) {
  console.log('--- Errores de consola/página detectados ---');
  console.log(errores.join('\n'));
  process.exitCode = 1;
}

await browser.close();
console.log(process.exitCode ? '\nRESULTADO: FALLÓ' : '\nRESULTADO: TODO OK');
