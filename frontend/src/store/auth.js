import { reactive } from 'vue';
import { api } from '../api.js';

// Store reactivo minimalista (sin Pinia/Vuex: alcance de esta primera
// versión no lo justifica todavía). Persiste el token en localStorage para
// sobrevivir a un refresh de página.
export const sesion = reactive({
  usuario: null,
  cargando: true,
});

export async function restaurarSesion() {
  if (!localStorage.getItem('accessToken')) {
    sesion.cargando = false;
    return;
  }
  try {
    sesion.usuario = await api.get('/usuarios/me');
  } catch {
    cerrarSesion();
  } finally {
    sesion.cargando = false;
  }
}

export async function iniciarSesion(email, password) {
  const tokens = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  sesion.usuario = await api.get('/usuarios/me');
}

export async function registrarse(datos) {
  await api.post('/auth/registro', datos);
  await iniciarSesion(datos.email, datos.password);
}

export function cerrarSesion() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sesion.usuario = null;
}

export async function esAdmin() {
  // M5 requiere el rol "administrador"; el perfil (Usuario) no expone roles
  // en el contrato openapi.yaml, así que se infiere probando el endpoint.
  try {
    await api.get('/admin/metricas');
    return true;
  } catch {
    return false;
  }
}
