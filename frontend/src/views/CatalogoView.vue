<script setup>
import { ref, onMounted, watch } from 'vue';
import { api } from '../api.js';
import { sesion } from '../store/auth.js';
import ProductoCard from '../components/ProductoCard.vue';

const productos = ref([]);
const categorias = ref([]);
const recomendaciones = ref([]);
const cargando = ref(true);
const cargandoMas = ref(false);
const cursorSiguiente = ref(null);
const error = ref('');
// Descarta respuestas de peticiones antiguas si el usuario cambia de filtro
// mientras hay una carga en curso.
let peticionActual = 0;

const filtros = ref({ categoria: '', tipoVenta: '', q: '' });

function aplanarCategorias(nodos, nivel = 0) {
  return nodos.flatMap((n) => [{ ...n, nivel }, ...aplanarCategorias(n.subcategorias || [], nivel + 1)]);
}

function parametrosBusqueda(cursor) {
  const params = new URLSearchParams();
  if (filtros.value.categoria) params.set('categoria', filtros.value.categoria);
  if (filtros.value.tipoVenta) params.set('tipoVenta', filtros.value.tipoVenta);
  if (filtros.value.q) params.set('q', filtros.value.q);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

async function cargarProductos() {
  const miPeticion = ++peticionActual;
  cargando.value = true;
  cargandoMas.value = false;
  error.value = '';
  try {
    const data = await api.get(`/productos?${parametrosBusqueda()}`);
    if (miPeticion !== peticionActual) return;
    productos.value = data.items;
    cursorSiguiente.value = data.cursorSiguiente || null;
  } catch (e) {
    if (miPeticion !== peticionActual) return;
    error.value = e.message;
  } finally {
    if (miPeticion === peticionActual) cargando.value = false;
  }
}

async function verMas() {
  if (!cursorSiguiente.value || cargandoMas.value) return;
  const miPeticion = peticionActual;
  cargandoMas.value = true;
  try {
    const data = await api.get(`/productos?${parametrosBusqueda(cursorSiguiente.value)}`);
    if (miPeticion !== peticionActual) return;
    productos.value = [...productos.value, ...data.items];
    cursorSiguiente.value = data.cursorSiguiente || null;
  } catch (e) {
    if (miPeticion === peticionActual) error.value = e.message;
  } finally {
    if (miPeticion === peticionActual) cargandoMas.value = false;
  }
}

async function cargarRecomendaciones() {
  if (!sesion.usuario) { recomendaciones.value = []; return; }
  try {
    const recs = await api.get('/recomendaciones');
    const detalles = await Promise.all(recs.slice(0, 4).map((r) => api.get(`/productos/${r.idProducto}`)));
    recomendaciones.value = detalles.map((p, i) => ({ ...p, motivo: recs[i].motivo }));
  } catch {
    recomendaciones.value = [];
  }
}

onMounted(async () => {
  categorias.value = aplanarCategorias(await api.get('/categorias'));
  await cargarProductos();
  await cargarRecomendaciones();
});

watch(() => sesion.usuario, cargarRecomendaciones);
watch(filtros, cargarProductos, { deep: true });
</script>

<template>
  <section v-if="sesion.usuario && recomendaciones.length" style="margin-bottom:28px">
    <h2>Recomendado para ti</h2>
    <div class="rejilla">
      <div v-for="p in recomendaciones" :key="p.id">
        <ProductoCard :producto="p" />
        <div style="font-size:11px;color:#888;margin-top:4px">{{ p.motivo }}</div>
      </div>
    </div>
  </section>

  <h2>Catálogo</h2>
  <div class="filtros">
    <select v-model="filtros.categoria">
      <option value="">Todas las categorías</option>
      <option v-for="c in categorias" :key="c.id" :value="c.id">{{ '—'.repeat(c.nivel) }} {{ c.nombre }}</option>
    </select>
    <select v-model="filtros.tipoVenta">
      <option value="">Todos los tipos de venta</option>
      <option value="fijo">Compra directa</option>
      <option value="subasta">Subasta</option>
    </select>
    <input v-model="filtros.q" placeholder="Buscar producto…" />
  </div>

  <div v-if="error" class="alerta error">{{ error }}</div>
  <p v-else-if="cargando">Cargando catálogo…</p>
  <p v-else-if="!productos.length">No hay productos que coincidan con los filtros.</p>
  <div v-else class="rejilla">
    <ProductoCard v-for="p in productos" :key="p.id" :producto="p" />
  </div>
  <div v-if="!error && !cargando && cursorSiguiente" style="text-align:center;margin:20px 0">
    <button :disabled="cargandoMas" @click="verMas">{{ cargandoMas ? 'Cargando…' : 'Ver más productos' }}</button>
  </div>
</template>
