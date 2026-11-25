import { query, withTransaction } from '../config/db.js';
import { ErrorValidacion } from '../utils/errors.js';

export async function buscarUsuarioPorId(idUsuario) {
  const { rows } = await query(
    'SELECT id, email, nombre, apellido, telefono, estado, fecha_registro FROM usuarios WHERE id = $1',
    [idUsuario]
  );
  return rows[0] ?? null;
}

export async function listarDireccionesUsuario(idUsuario) {
  const { rows } = await query(
    'SELECT id, pais, departamento, ciudad, detalle, es_principal FROM direcciones WHERE id_usuario = $1 ORDER BY es_principal DESC, id',
    [idUsuario]
  );
  return rows;
}

export async function actualizarPerfilUsuario(
  idUsuario,
  { nombre, apellido, telefono, direcciones }
) {
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE usuarios SET nombre = $1, apellido = $2, telefono = $3 WHERE id = $4',
      [nombre, apellido, telefono || null, idUsuario]
    );

    if (Array.isArray(direcciones)) {
      const idsGuardados = direcciones.flatMap((direccion) => direccion.id ? [direccion.id] : []);
      await client.query(
        'DELETE FROM direcciones WHERE id_usuario = $1 AND NOT (id = ANY($2::uuid[]))',
        [idUsuario, idsGuardados]
      );

      for (const d of direcciones) {
        const datos = [idUsuario, d.pais, d.departamento, d.ciudad, d.detalle, !!d.esPrincipal];
        if (d.id) {
          const { rowCount } = await client.query(
            `UPDATE direcciones SET pais = $2, departamento = $3, ciudad = $4, detalle = $5, es_principal = $6
             WHERE id_usuario = $1 AND id = $7`,
            [...datos, d.id]
          );
          if (!rowCount) throw ErrorValidacion('La dirección seleccionada no pertenece al usuario');
        } else {
          await client.query(
            `INSERT INTO direcciones (id_usuario, pais, departamento, ciudad, detalle, es_principal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            datos
          );
        }
      }
    }
  });
}
export async function buscarUsuarioPorEmail(email) {
  const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function usuarioTieneRol(idUsuario, rol) {
  const { rowCount } = await query(
    `SELECT 1 FROM roles r
     JOIN usuario_rol ur ON ur.id_rol = r.id
     WHERE ur.id_usuario = $1 AND r.nombre = $2`,
    [idUsuario, rol]
  );
  return rowCount > 0;
}

export function registrarUsuario({ email, hash, nombre, apellido, telefono }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, nombre, apellido, telefono, estado, fecha_registro`,
      [email, hash, nombre, apellido, telefono || null]
    );
    const usuario = rows[0];
    if (!usuario) return null;
    await client.query(
      "INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id FROM roles WHERE nombre = 'cliente'",
      [usuario.id]
    );
    return usuario;
  });
}
