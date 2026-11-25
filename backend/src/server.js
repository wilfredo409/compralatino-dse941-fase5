import 'dotenv/config';
import { app } from './app.js';
import { pool } from './config/db.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`CompraLatino API escuchando en http://localhost:${PORT}/api/v1`);
  console.log(`Documentación Swagger disponible en http://localhost:${PORT}/api/docs`);
});

function cerrar() {
  server.close(async (error) => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error('No se pudo cerrar el pool de PostgreSQL', poolError);
      process.exitCode = 1;
    }
    if (error) process.exitCode = 1;
  });
  server.closeIdleConnections();
}

process.once('SIGTERM', cerrar);
process.once('SIGINT', cerrar);
