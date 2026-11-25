<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sesion, cerrarSesion } from './store/auth.js';
import Icono from './components/Icono.vue';

const router = useRouter();
const route = useRoute();
const busqueda = ref('');
const campoBusqueda = ref(null);
const esAdministracion = computed(() => sesion.esAdmin && route.path.startsWith('/admin'));
const enlaceCuenta = computed(() => sesion.usuario ? '/cuenta' : '/ingresar');
const accesos = [
  { etiqueta: 'Explorar', tipo: '' },
  { etiqueta: 'Compra directa', tipo: 'fijo' },
  { etiqueta: 'Subastas', tipo: 'subasta' },
];

watch(() => route.query.q, (q) => { busqueda.value = typeof q === 'string' ? q : ''; }, { immediate: true });

function buscar() {
  const q = busqueda.value.trim();
  const query = route.path === '/' ? { ...route.query } : {};
  delete query.q;
  if (q) query.q = q;
  router.push({ path: '/', query, hash: '#resultados' });
}

async function enfocarBusqueda() {
  if (esAdministracion.value) await router.push('/');
  await nextTick();
  campoBusqueda.value?.focus();
}

function salir() {
  cerrarSesion();
  router.push('/');
}
</script>

<template>
  <a href="#contenido" class="salto-contenido">Saltar al contenido</a>
  <header class="barra">
    <div class="contenedor cabecera-tienda">
      <RouterLink to="/" class="marca" aria-label="CompraLatino, inicio">
        <span class="marca-simbolo" aria-hidden="true"></span>
        <span>Compra<span class="marca-acento">Latino</span></span>
      </RouterLink>

      <form v-if="!esAdministracion" class="buscador-global" role="search" @submit.prevent="buscar">
        <Icono nombre="buscar" />
        <label class="solo-lectores" for="busqueda-global">Buscar en el catálogo</label>
        <input id="busqueda-global" ref="campoBusqueda" v-model="busqueda" type="search" placeholder="Busca cámaras, relojes, papelería…" />
        <button type="submit">Buscar</button>
      </form>

      <nav class="cuenta-superior" :class="{ 'cuenta-admin': esAdministracion }" aria-label="Cuenta">
        <template v-if="sesion.usuario">
          <RouterLink v-if="esAdministracion" to="/" class="enlace-header">Ir a la tienda</RouterLink>
          <RouterLink v-else to="/mis-pedidos" class="enlace-header"><Icono nombre="paquete" /> Mis pedidos</RouterLink>
          <RouterLink :to="enlaceCuenta" class="enlace-header"><Icono nombre="usuario" /> Mi cuenta</RouterLink>
          <button v-if="esAdministracion" class="enlace-header" type="button" @click="salir"><Icono nombre="salir" /> Salir</button>
        </template>
        <template v-else>
          <RouterLink to="/ingresar" class="enlace-header"><Icono nombre="usuario" /> Ingresar</RouterLink>
          <RouterLink to="/registro" class="enlace-registro">Crear cuenta</RouterLink>
        </template>
      </nav>
    </div>

    <div v-if="!esAdministracion" class="franja-navegacion">
      <nav class="contenedor navegacion-tienda" aria-label="Tienda">
        <RouterLink v-for="acceso in accesos" :key="acceso.tipo"
          :to="acceso.tipo ? { path: '/', query: { tipoVenta: acceso.tipo }, hash: '#resultados' } : '/'"
          :class="{ activo: route.path === '/' && (route.query.tipoVenta || '') === acceso.tipo }">
          {{ acceso.etiqueta }}
        </RouterLink>
        <RouterLink v-if="sesion.esAdmin" to="/admin" class="enlace-admin">Administración <Icono nombre="flecha" :tamano="15" /></RouterLink>
      </nav>
    </div>
  </header>

  <main id="contenido" class="contenedor contenido" :class="{ 'contenido-admin': esAdministracion }">
    <RouterView />
  </main>

  <footer v-if="!esAdministracion" class="pie-tienda">
    <div class="contenedor">
      <strong>CompraLatino</strong>
      <span>Artículos de Japón para Latinoamérica</span>
      <RouterLink to="/creditos">Créditos de imágenes</RouterLink>
    </div>
  </footer>
  <nav v-if="!esAdministracion" class="navegacion-inferior" aria-label="Navegación móvil">
    <RouterLink to="/"><Icono nombre="inicio" />Catálogo</RouterLink>
    <button type="button" @click="enfocarBusqueda"><Icono nombre="buscar" />Buscar</button>
    <RouterLink v-if="sesion.usuario" to="/mis-pedidos"><Icono nombre="paquete" />Pedidos</RouterLink>
    <RouterLink :to="enlaceCuenta"><Icono nombre="usuario" />{{ sesion.usuario ? 'Cuenta' : 'Ingresar' }}</RouterLink>
  </nav>
</template>
