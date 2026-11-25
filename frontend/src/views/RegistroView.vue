<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { registrarse } from '../store/auth.js';

const router = useRouter();
const route = useRoute();
const form = ref({ nombre: '', apellido: '', email: '', password: '', telefono: '' });
const error = ref('');
const cargando = ref(false);

async function enviar() {
  error.value = '';
  cargando.value = true;
  try {
    await registrarse(form.value);
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
      <h1>Crear cuenta</h1>
      <p class="texto-secundario">Guarda tus direcciones y consulta tus pedidos en un solo lugar.</p>
      <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
      <form class="form" @submit.prevent="enviar">
        <div class="form-columnas">
          <label for="registro-nombre">Nombre<input id="registro-nombre" v-model.trim="form.nombre" maxlength="80" required autocomplete="given-name" /></label>
          <label for="registro-apellido">Apellido<input id="registro-apellido" v-model.trim="form.apellido" maxlength="80" required autocomplete="family-name" /></label>
        </div>
        <label for="registro-correo">Correo electrónico</label><input id="registro-correo" v-model.trim="form.email" type="email" required autocomplete="email" />
        <label for="registro-telefono">Teléfono (opcional)</label><input id="registro-telefono" v-model.trim="form.telefono" maxlength="25" type="tel" autocomplete="tel" />
        <label for="registro-contrasena">Contraseña de al menos 8 caracteres</label><input id="registro-contrasena" v-model="form.password" type="password" minlength="8" required autocomplete="new-password" />
        <button class="btn" type="submit" :disabled="cargando">{{ cargando ? 'Creando…' : 'Crear cuenta' }}</button>
      </form>
      <p>¿Ya tienes una cuenta? <RouterLink :to="{ path: '/ingresar', query: route.query }">Ingresar</RouterLink></p>
    </section>
  </div>
</template>
