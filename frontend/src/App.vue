<script setup>
import { sesion, cerrarSesion } from './store/auth.js';
import { useRouter } from 'vue-router';

const router = useRouter();
function salir() {
  cerrarSesion();
  router.push('/');
}
</script>

<template>
  <header class="barra">
    <div class="contenedor">
      <RouterLink to="/" class="marca">CompraLatino</RouterLink>
      <nav>
        <RouterLink to="/" active-class="activo">Catálogo</RouterLink>
        <RouterLink v-if="sesion.usuario" to="/mis-pedidos" active-class="activo">Mis pedidos</RouterLink>
        <RouterLink v-if="sesion.usuario" to="/admin" active-class="activo">Administración</RouterLink>
        <template v-if="sesion.usuario">
          <span>{{ sesion.usuario.nombre }}</span>
          <button @click="salir">Salir</button>
        </template>
        <template v-else>
          <RouterLink to="/ingresar" active-class="activo">Ingresar</RouterLink>
          <RouterLink to="/registro" active-class="activo">Crear cuenta</RouterLink>
        </template>
      </nav>
    </div>
  </header>
  <main class="contenedor">
    <RouterView />
  </main>
</template>
