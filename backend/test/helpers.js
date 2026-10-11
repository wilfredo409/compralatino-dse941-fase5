// Utilidades compartidas por las pruebas. IMPORTAR PRIMERO en cada archivo de
// prueba, antes de importar la app: fija las variables de entorno que la app
// lee al cargarse (dotenv no pisa las que ya existen).
process.env.JWT_SECRET ||= 'secreto-solo-para-pruebas';
process.env.WEBHOOK_SECRET ||= 'webhook-solo-para-pruebas';
process.env.YAUCTIONS_LATENCY_MS_MIN = '0';
process.env.YAUCTIONS_LATENCY_MS_MAX = '0';

// Las pruebas de API necesitan PostgreSQL (con el esquema de deploy/db-init).
// Si DATABASE_URL no está definida, esas pruebas se omiten con un aviso.
export const hayBD = Boolean(process.env.DATABASE_URL);
export const SIN_BD = hayBD ? false : 'Define DATABASE_URL para ejecutar las pruebas de API (ver test/README.md)';

/** Sufijo único por ejecución para no chocar con datos del seed ni con otros archivos de prueba. */
export const sufijo = `${Date.now().toString(36)}${process.pid}${Math.floor(Math.random() * 1e4)}`;

/** Registra un usuario por la API y devuelve { id, email, password, token }. */
export async function crearUsuarioConSesion(request, app, etiqueta) {
  const email = `test.${etiqueta}.${sufijo}@pruebas.compralatino.test`;
  const password = 'Prueba1234!';
  const reg = await request(app).post('/api/v1/auth/registro').send({ email, password, nombre: 'Prueba', apellido: etiqueta });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { id: reg.body.id, email, password, token: login.body.accessToken };
}

/** Crea una categoría y N productos (de venta fija por defecto, o 'subasta'); devuelve { idCategoria, productos: [{id, precioUsd, stock}] }. */
export async function crearCatalogoDePrueba(pool, etiqueta, { cantidad = 3, precioUsd = 100, stock = 5, tipoVenta = 'fijo' } = {}) {
  const cat = await pool.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [`Prueba ${etiqueta} ${sufijo}`]);
  const productos = [];
  for (let i = 0; i < cantidad; i++) {
    const { rows } = await pool.query(
      `INSERT INTO productos (id_externo_ya, id_categoria, titulo, precio_jpy, precio_usd, tipo_venta, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [`TEST-${etiqueta}-${sufijo}-${i}`, cat.rows[0].id, `Producto de prueba ${etiqueta} ${i}`, precioUsd * 150, precioUsd, tipoVenta, stock]
    );
    productos.push({ id: rows[0].id, precioUsd, stock, titulo: `Producto de prueba ${etiqueta} ${i}` });
  }
  return { idCategoria: cat.rows[0].id, productos };
}

/** Da el rol «administrador» (M5) a un usuario; crea el rol si la base aún no tiene el seed. */
export async function otorgarRolAdministrador(pool, idUsuario) {
  await pool.query(
    "INSERT INTO roles (nombre, descripcion) VALUES ('administrador', 'Gestión y monitoreo (M5)') ON CONFLICT (nombre) DO NOTHING"
  );
  await pool.query(
    `INSERT INTO usuario_rol (id_usuario, id_rol)
     SELECT $1, id FROM roles WHERE nombre = 'administrador' ON CONFLICT DO NOTHING`,
    [idUsuario]
  );
}

/** Quita el rol «administrador» solo si lo creó la prueba y ya nadie lo usa (así no choca con `npm run seed` en una base vacía). */
export async function retirarRolAdministradorSiSobra(pool) {
  await pool.query(
    `DELETE FROM roles WHERE nombre = 'administrador'
       AND NOT EXISTS (SELECT 1 FROM usuario_rol ur WHERE ur.id_rol = roles.id)`
  );
}

export async function crearDireccion(pool, idUsuario) {
  const { rows } = await pool.query(
    `INSERT INTO direcciones (id_usuario, pais, departamento, ciudad, detalle, es_principal)
     VALUES ($1, 'El Salvador', 'San Salvador', 'San Salvador', 'Colonia de pruebas', true) RETURNING id`,
    [idUsuario]
  );
  return rows[0].id;
}

/** Borra todo lo creado por una prueba (orden respetando las llaves foráneas). */
export async function limpiar(pool, { idsUsuario = [], idCategoria = null }) {
  if (idsUsuario.length) {
    await pool.query('DELETE FROM pedidos WHERE id_usuario = ANY($1::uuid[])', [idsUsuario]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1::uuid[])', [idsUsuario]);
  }
  if (idCategoria) {
    await pool.query('DELETE FROM productos WHERE id_categoria = $1', [idCategoria]);
    await pool.query('DELETE FROM categorias WHERE id = $1', [idCategoria]);
  }
}
