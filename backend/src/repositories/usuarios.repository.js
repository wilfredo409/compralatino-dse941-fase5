import { query, withTransaction } from '../config/db.js';

export async function buscarUsuarioPorId(idUsuario) {
  const { rows } = await query(
    'SELECT id, email, nombre, apellido, telefono, estado, fecha_registro FROM usuarios WHERE id = $1',
    [idUsuario]
  );
  return rows[0] ?? null;
}

export async function listarDireccionesUsuario(idUsuario) {
  const { rows } = await query(
    'SELECT id, pais, departamento, ciudad, detalle, es_principal FROM direcciones WHERE id_usuario = $1',
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
      await client.query(
        'DELETE FROM direcciones WHERE id_usuario = $1',
        [idUsuario]
      );

      for (const d of direcciones) {
        await client.query(
          `INSERT INTO direcciones
           (id_usuario, pais, departamento, ciudad, detalle, es_principal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            idUsuario,
            d.pais,
            d.departamento,
            d.ciudad,
            d.detalle,
            !!d.esPrincipal,
          ]
        );
      }
    }
  });
}