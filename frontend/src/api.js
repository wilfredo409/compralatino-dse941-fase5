// Cliente HTTP mínimo hacia la API (contrato en openapi.yaml). Sin librerías
// externas de por medio (fetch nativo) para que el flujo sea transparente.

const BASE = '/api/v1';

function tokenActual() {
  return localStorage.getItem('accessToken');
}

async function solicitar(metodo, ruta, cuerpo) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenActual();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });

  const contentType = resp.headers.get('content-type') || '';
  const datos = contentType.includes('application/json') ? await resp.json() : await resp.text();

  if (!resp.ok) {
    const error = new Error(datos?.mensaje || 'Error de red');
    error.status = resp.status;
    error.codigo = datos?.codigo;
    error.detalle = datos?.detalle;
    throw error;
  }
  return datos;
}

export const api = {
  get: (ruta) => solicitar('GET', ruta),
  post: (ruta, cuerpo) => solicitar('POST', ruta, cuerpo),
  put: (ruta, cuerpo) => solicitar('PUT', ruta, cuerpo),
};
