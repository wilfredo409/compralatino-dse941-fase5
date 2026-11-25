import { pool, withTransaction } from '../src/config/db.js';
import { cargarCatalogoDemo } from './catalogo-demo.js';
import { productosDemo } from './productos-demo.js';

try {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int total FROM usuarios
       WHERE email IN ('admin@compralatino.com', 'laura.pineda@demo.compralatino.com', 'lucia.hernandez@demo.compralatino.com')`
    );
    if (rows[0].total !== 3) throw new Error('Esta base no tiene los perfiles del entorno de demostración');
    await cargarCatalogoDemo(client);
  });
  console.log(`Catálogo de demostración actualizado: ${productosDemo.length} artículos.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
