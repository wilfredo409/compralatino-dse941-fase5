<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrarse } from '../store/auth.js';

const router = useRouter();
const form = ref({ nombre: '', apellido: '', email: '', password: '', telefono: '' });
const error = ref('');
const cargando = ref(false);

async function enviar() {
  error.value = '';
  cargando.value = true;
  try {
    await registrarse(form.value);
    router.push('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <h2>Crear cuenta</h2>
  <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
  <form class="form" @submit.prevent="enviar">
    <label>Nombre</label>
    <input v-model="form.nombre" required />
    <label>Apellido</label>
    <input v-model="form.apellido" required />
    <label>Correo</label>
    <input v-model="form.email" type="email" required />
    <label>Teléfono (opcional)</label>
    <input v-model="form.telefono" />
    <label>Contraseña (mínimo 8 caracteres)</label>
    <input v-model="form.password" type="password" minlength="8" required />
    <button class="btn" type="submit" :disabled="cargando">{{ cargando ? 'Creando…' : 'Crear cuenta' }}</button>
  </form>
</template>
