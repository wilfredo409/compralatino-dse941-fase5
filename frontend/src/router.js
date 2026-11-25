import { createRouter, createWebHistory } from 'vue-router';
import { sesion } from './store/auth.js';

import CatalogoView from './views/CatalogoView.vue';
import ProductoDetalleView from './views/ProductoDetalleView.vue';
import LoginView from './views/LoginView.vue';
import RegistroView from './views/RegistroView.vue';
import PedidosView from './views/PedidosView.vue';
import AdminView from './views/AdminView.vue';
import CuentaView from './views/CuentaView.vue';
import CreditosView from './views/CreditosView.vue';

const routes = [
  { path: '/', component: CatalogoView },
  { path: '/productos/:id', component: ProductoDetalleView, props: true },
  { path: '/ingresar', component: LoginView },
  { path: '/registro', component: RegistroView },
  { path: '/creditos', component: CreditosView },
  { path: '/mis-pedidos', component: PedidosView, meta: { requiereAuth: true } },
  { path: '/cuenta', component: CuentaView, meta: { requiereAuth: true } },
  { path: '/admin/:vista?', component: AdminView, meta: { requiereAuth: true } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, posicionGuardada) {
    if (posicionGuardada) return posicionGuardada;
    if (to.hash) return { el: to.hash, top: 16 };
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  if (to.meta.requiereAuth && !sesion.usuario && !sesion.cargando) {
    return { path: '/ingresar', query: { redirigirA: to.fullPath } };
  }
  return true;
});
