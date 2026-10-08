import pg from 'pg';
import 'dotenv/config';

// Pool único de conexiones a PostgreSQL 16 (ADR-04). Todas las consultas del
// backend pasan por aquí — sin ORM, SQL parametrizado explícito para que el
// mapeo con schema.sql (Fase 2) sea trazable durante la defensa.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Conexión perdida en un cliente inactivo del pool: se registra, no se
  // tumba el proceso (evita que un solo error de conexión derribe la API).
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

/** Ejecuta `fn` dentro de una transacción (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
