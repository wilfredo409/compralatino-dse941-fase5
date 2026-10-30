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
    router.push(route.query.redirigirA || '/');
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <h2>Ingresar</h2>
  <p class="alerta" style="background:#eef2ff;color:#333">
    Cuentas demo: <code>admin@compralatino.com</code> / <code>Admin1234!</code>
    (administración) o <code>laura.pineda@demo.compralatino.com</code> / <code>Demo1234!</code> (cliente).
  </p>
  <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
  <form class="form" @submit.prevent="enviar">
    <label for="login-correo">Correo</label>
    <input id="login-correo" v-model="email" type="email" required autocomplete="username" />
    <label for="login-contrasena">Contraseña</label>
    <input id="login-contrasena" v-model="password" type="password" required autocomplete="current-password" />
    <button class="btn" type="submit" :disabled="cargando">{{ cargando ? 'Ingresando…' : 'Ingresar' }}</button>
  </form>
</template>
