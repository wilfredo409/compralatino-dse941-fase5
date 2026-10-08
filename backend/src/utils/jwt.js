import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SECRET = process.env.JWT_SECRET;
const ACCESS_TTL = Number(process.env.JWT_EXPIRES_IN || 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_EXPIRES_IN || 1209600);

export function emitirTokenPar(usuario) {
  const payload = { sub: usuario.id, email: usuario.email };
  const accessToken = jwt.sign(payload, SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ ...payload, tipo: 'refresh' }, SECRET, {
    expiresIn: REFRESH_TTL,
  });
  return { accessToken, refreshToken, expiraEn: ACCESS_TTL };
}

export function verificarToken(token) {
  return jwt.verify(token, SECRET);
}
