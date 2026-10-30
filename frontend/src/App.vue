<script setup>
import { ref, watch } from 'vue';
import { sesion, cerrarSesion } from './store/auth.js';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const menuAbierto = ref(false);
const cuentaAbierta = ref(false);

watch(() => route.fullPath, () => {
  menuAbierto.value = false;
  cuentaAbierta.value = false;
});

function salir() {
  cerrarSesion();
  cuentaAbierta.value = false;
  router.push('/');
}
</script>

<template>
  <header class="barra">
    <div class="contenedor">
      <RouterLink to="/" class="marca">CompraLatino</RouterLink>
      <nav class="navegacion-escritorio" aria-label="Navegación principal">
        <RouterLink to="/" active-class="activo">Catálogo</RouterLink>
        <RouterLink v-if="sesion.usuario" to="/mis-pedidos" active-class="activo">Mis pedidos</RouterLink>
        <RouterLink v-if="sesion.esAdmin" to="/admin" active-class="activo">Administración</RouterLink>
        <template v-if="sesion.usuario">
          <span>{{ sesion.usuario.nombre }}</span>
          <button @click="salir">Salir</button>
        </template>
        <template v-else>
          <RouterLink to="/ingresar" active-class="activo">Ingresar</RouterLink>
          <RouterLink to="/registro" active-class="activo">Crear cuenta</RouterLink>
        </template>
      </nav>
      <button
        class="boton-menu-tableta"
        type="button"
        aria-controls="menu-tableta"
        :aria-expanded="menuAbierto"
        @click="menuAbierto = !menuAbierto"
      >
        {{ menuAbierto ? 'Cerrar menú' : 'Menú' }}
      </button>
      <nav v-if="menuAbierto" id="menu-tableta" class="menu-tableta" aria-label="Navegación">
        <RouterLink to="/" active-class="activo">Catálogo</RouterLink>
        <RouterLink v-if="sesion.usuario" to="/mis-pedidos" active-class="activo">Mis pedidos</RouterLink>
        <RouterLink v-if="sesion.esAdmin" to="/admin" active-class="activo">Administración</RouterLink>
        <template v-if="sesion.usuario">
          <span>{{ sesion.usuario.nombre }}</span>
          <button type="button" @click="salir">Salir</button>
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
  <nav class="navegacion-inferior" aria-label="Navegación móvil">
    <RouterLink to="/" active-class="activo">
      <span aria-hidden="true">⌂</span><span>Inicio</span>
    </RouterLink>
    <RouterLink :to="{ path: '/', query: { filtros: 'abrir' } }" active-class="activo">
      <span aria-hidden="true">⌕</span><span>Filtros</span>
    </RouterLink>
    <RouterLink to="/mis-pedidos" active-class="activo">
      <span aria-hidden="true">▤</span><span>Pedidos</span>
    </RouterLink>
    <button type="button" :aria-expanded="cuentaAbierta" @click="cuentaAbierta = !cuentaAbierta">
      <span aria-hidden="true">☰</span><span>Cuenta</span>
    </button>
  </nav>
  <div v-if="cuentaAbierta" class="fondo-menu" @click.self="cuentaAbierta = false">
    <nav class="menu-cuenta" aria-label="Opciones de cuenta">
      <button class="cerrar-panel" type="button" @click="cuentaAbierta = false">Cerrar</button>
      <template v-if="sesion.usuario">
        <span class="nombre-cuenta">{{ sesion.usuario.nombre }}</span>
        <RouterLink to="/mis-pedidos">Mis pedidos</RouterLink>
        <RouterLink v-if="sesion.esAdmin" to="/admin">Administración</RouterLink>
        <button type="button" @click="salir">Salir</button>
      </template>
      <template v-else>
        <RouterLink to="/ingresar">Ingresar</RouterLink>
        <RouterLink to="/registro">Crear cuenta</RouterLink>
      </template>
    </nav>
  </div>
</template>
