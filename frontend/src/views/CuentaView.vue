<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { cerrarSesion, sesion } from '../store/auth.js';
import { useRouter } from 'vue-router';
import DireccionFields from '../components/DireccionFields.vue';
import Icono from '../components/Icono.vue';

const router = useRouter();
const perfil = ref(null);
const cargando = ref(true);
const guardando = ref(false);
const error = ref('');
const mensaje = ref('');
const editar = ref(null);
const nueva = () => ({ pais: 'El Salvador', departamento: '', ciudad: '', detalle: '' });
const borrador = ref(nueva());
const direcciones = computed(() => perfil.value?.direcciones || []);

onMounted(async () => {
  try { perfil.value = await api.get('/usuarios/me'); }
  catch (e) { error.value = e.message; }
  finally { cargando.value = false; }
});

async function guardar(datos, guardado) {
  error.value = '';
  mensaje.value = '';
  guardando.value = true;
  try {
    perfil.value = await api.put('/usuarios/me', datos);
    sesion.usuario = perfil.value;
    mensaje.value = guardado;
    return true;
  } catch (e) {
    error.value = e.message;
    return false;
  } finally {
    guardando.value = false;
  }
}

function datosPersonales() {
  const { nombre, apellido, telefono } = perfil.value;
  return { nombre, apellido, telefono };
}
function editarDireccion(indice) {
  editar.value = indice;
  borrador.value = indice === -1 ? nueva() : { ...direcciones.value[indice] };
}
async function guardarDireccion() {
  const lista = [...direcciones.value];
  if (editar.value === -1) lista.push({ ...borrador.value, esPrincipal: !lista.length });
  else lista[editar.value] = { ...borrador.value };
  if (await guardar({ ...datosPersonales(), direcciones: lista }, 'Dirección guardada.')) editar.value = null;
}
async function principal(indice) {
  const lista = direcciones.value.map((direccion, i) => ({ ...direccion, esPrincipal: i === indice }));
  await guardar({ ...datosPersonales(), direcciones: lista }, 'Dirección principal actualizada.');
}
function salir() { cerrarSesion(); router.push('/'); }
</script>

<template>
  <header class="encabezado-pagina"><div><h1>Mi cuenta</h1><p>Datos personales y direcciones de envío</p></div><button type="button" class="btn secundario" @click="salir"><Icono nombre="salir" :tamano="17" /> Salir</button></header>
  <p v-if="cargando" class="estado-vista" role="status">Cargando cuenta…</p>
  <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
  <p v-if="mensaje" class="alerta exito" role="status">{{ mensaje }}</p>
  <div v-if="perfil" class="cuenta-layout">
    <section class="superficie">
      <h2>Datos personales</h2>
      <form class="form" @submit.prevent="guardar(datosPersonales(), 'Perfil actualizado.')">
        <label for="perfil-correo">Correo electrónico</label>
        <input id="perfil-correo" :value="perfil.email" type="email" readonly />
        <label for="perfil-nombre">Nombre</label><input id="perfil-nombre" v-model.trim="perfil.nombre" maxlength="80" required autocomplete="given-name" />
        <label for="perfil-apellido">Apellido</label><input id="perfil-apellido" v-model.trim="perfil.apellido" maxlength="80" required autocomplete="family-name" />
        <label for="perfil-telefono">Teléfono</label><input id="perfil-telefono" v-model.trim="perfil.telefono" maxlength="25" type="tel" autocomplete="tel" />
        <button type="submit" class="btn" :disabled="guardando">Guardar datos</button>
      </form>
    </section>
    <section class="superficie">
      <div class="encabezado-seccion"><h2>Direcciones</h2><button type="button" class="btn secundario" :disabled="guardando" @click="editarDireccion(-1)">Agregar dirección</button></div>
      <p v-if="!direcciones.length && editar === null">Aún no tienes direcciones guardadas.</p>
      <ul v-if="direcciones.length" class="lista-direcciones">
        <li v-for="(direccion, indice) in direcciones" :key="direccion.id">
          <div><strong>{{ direccion.detalle }}</strong><p>{{ direccion.ciudad }}, {{ direccion.departamento }}, {{ direccion.pais }}</p></div>
          <span v-if="direccion.esPrincipal" class="etiqueta">Principal</span>
          <div class="acciones-inline">
            <button type="button" class="enlace-boton" :disabled="guardando" @click="editarDireccion(indice)">Editar</button>
            <button v-if="!direccion.esPrincipal" type="button" class="enlace-boton" :disabled="guardando" @click="principal(indice)">Usar como principal</button>
          </div>
        </li>
      </ul>
      <form v-if="editar !== null" class="form direccion-editar" @submit.prevent="guardarDireccion">
        <h3>{{ editar === -1 ? 'Nueva dirección' : 'Editar dirección' }}</h3>
        <DireccionFields prefix="cuenta-direccion" v-model="borrador" />
        <div class="acciones-inline"><button class="btn" type="submit" :disabled="guardando">Guardar dirección</button><button class="btn secundario" type="button" @click="editar = null">Cancelar</button></div>
      </form>
    </section>
  </div>
</template>
