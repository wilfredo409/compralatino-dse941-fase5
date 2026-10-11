import '../helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';

// La configuración del adaptador se lee al cargar el módulo; el sufijo ?caso
// obliga a Node a cargar una copia nueva con el entorno de cada caso.
async function cargarAdaptador(caso, entorno) {
  Object.assign(process.env, {
    YAUCTIONS_LATENCY_MS_MIN: '0',
    YAUCTIONS_LATENCY_MS_MAX: '0',
    YAUCTIONS_BREAKER_THRESHOLD: '3',
    YAUCTIONS_BREAKER_COOLDOWN_MS: '300',
    ...entorno,
  });
  const modulo = await import(`../../src/adapters/YAuctionsAdapter.js?${caso}`);
  return modulo.yAuctionsAdapter;
}

const ID_PRODUCTO = '11111111-2222-3333-4444-555555555555';

test('con la interfaz externa sana, la oferta se acepta y el circuito sigue cerrado', async () => {
  const adaptador = await cargarAdaptador('sana', { YAUCTIONS_FAILURE_RATE: '0' });
  const resultado = await adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 5000 });
  assert.equal(resultado.aceptada, true);
  assert.equal(resultado.montoJpy, 5000);
  assert.equal(adaptador.salud().circuito, 'CERRADO');
  assert.equal(adaptador.salud().fallos, 0);
});

test('el catálogo se sirve desde caché en la segunda lectura', async () => {
  const adaptador = await cargarAdaptador('cache', { YAUCTIONS_FAILURE_RATE: '0' });
  const primera = await adaptador.sincronizarCatalogo();
  const segunda = await adaptador.sincronizarCatalogo();
  const forzada = await adaptador.sincronizarCatalogo({ forzar: true });
  assert.equal(primera.deCache, false);
  assert.equal(segunda.deCache, true);
  assert.equal(forzada.deCache, false);
});

test('tras 3 fallos consecutivos el circuito se abre y rechaza llamadas sin intentarlas', async () => {
  const adaptador = await cargarAdaptador('abre', { YAUCTIONS_FAILURE_RATE: '1' });
  await assert.rejects(() => adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 1 }), (e) => e.circuitoAbierto === true);
  assert.equal(adaptador.salud().circuito, 'ABIERTO');
  assert.equal(adaptador.salud().fallos, 3);

  const antes = adaptador.salud().llamadas;
  await assert.rejects(() => adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 1 }), /circuito ABIERTO/);
  assert.equal(adaptador.salud().llamadas, antes, 'con el circuito abierto no debe llamarse a la interfaz externa');
});

test('el circuito abierto pasa a semi-abierto tras el enfriamiento y se cierra con un éxito', async () => {
  const adaptador = await cargarAdaptador('recupera', { YAUCTIONS_FAILURE_RATE: '0' });
  // Forzamos fallos desde la capa de negocio (simularFallo) hasta abrir el circuito.
  await assert.rejects(() => adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 1, simularFallo: true }));
  assert.equal(adaptador.salud().circuito, 'ABIERTO');

  await new Promise((r) => setTimeout(r, 350)); // enfriamiento de 300 ms
  const resultado = await adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 2 });
  assert.equal(resultado.aceptada, true);
  assert.equal(adaptador.salud().circuito, 'CERRADO');
});

test('si la llamada de prueba del semi-abierto falla, el circuito vuelve a abrirse', async () => {
  const adaptador = await cargarAdaptador('reabre', { YAUCTIONS_FAILURE_RATE: '0' });
  await assert.rejects(() => adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 1, simularFallo: true }));
  await new Promise((r) => setTimeout(r, 350));
  await assert.rejects(() => adaptador.enviarOferta({ idProducto: ID_PRODUCTO, montoJpy: 1, simularFallo: true }));
  assert.equal(adaptador.salud().circuito, 'ABIERTO');
});
