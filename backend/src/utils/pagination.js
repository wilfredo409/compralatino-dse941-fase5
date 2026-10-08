// Paginación por cursor (PaginaCursor en openapi.yaml): el cursor es el id
// UUID del último registro de la página anterior, codificado en base64 junto
// con su timestamp de orden para evitar problemas cuando dos filas comparten
// el mismo instante de creación.

export function decodificarCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function codificarCursor(valorOrden, id) {
  const json = JSON.stringify({ o: valorOrden, id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function limiteDesdeQuery(query, porDefecto = 20, maximo = 100) {
  const n = Number(query.limite);
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(n, maximo);
}
