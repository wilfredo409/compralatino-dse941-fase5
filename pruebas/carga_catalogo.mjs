import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:8080');
const concurrencia = 20;
const repeticiones = 25;
const umbralP90Ms = 2000;
const terminos = ['', 'sony', 'cámara', 'reloj'];
const latencias = [];
let errores = 0;

async function consultar(indice) {
  const ruta = new URL('/api/v1/productos', base);
  ruta.searchParams.set('q', terminos[indice % terminos.length]);
  ruta.searchParams.set('limite', '20');
  const inicio = performance.now();
  try {
    const respuesta = await fetch(ruta, { signal: AbortSignal.timeout(8000) });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok || !Array.isArray(cuerpo.items)) throw new Error(`HTTP ${respuesta.status}`);
    latencias.push(performance.now() - inicio);
  } catch {
    errores += 1;
  }
}

await Promise.all(Array.from({ length: concurrencia }, async (_, turno) => {
  for (let i = 0; i < repeticiones; i++) await consultar(turno + i);
}));

latencias.sort((a, b) => a - b);
const p90 = latencias.length ? Number(latencias[Math.ceil(latencias.length * 0.9) - 1].toFixed(2)) : null;
console.log(JSON.stringify({
  origen: base.origin, solicitudes: concurrencia * repeticiones, concurrencia,
  exitosas: latencias.length, errores, p90Ms: p90, umbralP90Ms,
}, null, 2));
assert.ok(!errores && p90 !== null && p90 < umbralP90Ms, 'RNF-01 no cumple para el perfil ejecutado');
