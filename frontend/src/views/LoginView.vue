<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { iniciarSesion } from '../store/auth.js';

const router = useRouter();
const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);

async function enviar() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion(email.value, password.value);
    const destino = route.query.redirigirA;
    router.push(typeof destino === 'string' && destino.startsWith('/') && !destino.startsWith('//') ? destino : '/');
  } catch (e) { error.value = e.message; }
  finally { cargando.value = false; }
}
</script>

<template>
  <div class="autenticacion">
    <section class="auth-lateral" aria-hidden="true"><img src="/catalogo/portada-japon.webp" alt="" /></section>
    <section class="auth-form">
      <h1>Ingresar</h1>
      <p class="texto-secundario">Accede a tus pedidos, ofertas y direcciones.</p>
      <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
      <form class="form" @submit.prevent="enviar">
        <label for="login-correo">Correo electrónico</label><input id="login-correo" v-model.trim="email" type="email" required autocomplete="username" />
        <label for="login-contrasena">Contraseña</label><input id="login-contrasena" v-model="password" type="password" required autocomplete="current-password" />
        <button class="btn" type="submit" :disabled="cargando">{{ cargando ? 'Ingresando…' : 'Ingresar' }}</button>
      </form>
      <p>¿Primera vez en CompraLatino? <RouterLink :to="{ path: '/registro', query: route.query }">Crear cuenta</RouterLink></p>
    </section>
  </div>
</template>
