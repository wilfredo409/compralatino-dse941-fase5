<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { sesion } from '../store/auth.js';
import ProductoCard from '../components/ProductoCard.vue';
import Icono from '../components/Icono.vue';

const route = useRoute();
const router = useRouter();
const productos = ref([]);
const categorias = ref([]);
const recomendaciones = ref([]);
const cargando = ref(true);
const cargandoMas = ref(false);
const cursorSiguiente = ref(null);
const error = ref('');
const filtroMovil = ref(false);
const claves = ['categoria', 'tipoVenta', 'precioMin', 'precioMax', 'q'];
const filtros = computed(() => Object.fromEntries(claves.map((clave) => [
  clave, typeof route.query[clave] === 'string' ? route.query[clave] : '',
])));
const activos = computed(() => Object.values(filtros.value).some(Boolean));
const precioMin = ref('');
const precioMax = ref('');
const errorPrecio = ref('');
let peticionActual = 0;
let peticionRecomendaciones = 0;

const colecciones = [
  { nombres: ['Cámaras'], titulo: 'Fotografía', imagen: 'canon-ae1' },
  { nombres: ['Electrónica'], titulo: 'Electrónica', imagen: 'sony-xm4' },
  { nombres: ['Relojería'], titulo: 'Relojería', imagen: 'seiko5' },
  { nombres: ['Coleccionables'], titulo: 'Coleccionables', imagen: 'tomica-auto' },
  { nombres: ['Papelería japonesa'], titulo: 'Papelería', imagen: 'pluma-pilot' },
  { nombres: ['Hogar y artesanía'], titulo: 'Hogar y artesanía', imagen: 'taza-mino' },
];

function aplanar(nodos, nivel = 0) {
  return nodos.flatMap((n) => [{ ...n, nivel }, ...aplanar(n.subcategorias || [], nivel + 1)]);
}

function enlaceColeccion(coleccion) {
  const categoria = categorias.value.find((item) => coleccion.nombres.includes(item.nombre));
  return categoria ? { path: '/', query: { categoria: String(categoria.id) }, hash: '#resultados' } : { path: '/', hash: '#resultados' };
}

function aplicar(filtrosNuevos) {
  const query = Object.fromEntries(Object.entries({ ...filtros.value, ...filtrosNuevos }).filter(([, valor]) => valor !== '' && valor != null));
  router.replace({ path: '/', query, hash: '#resultados' });
}

function aplicarPrecio() {
  errorPrecio.value = '';
  if (precioMin.value !== '' && precioMax.value !== '' && Number(precioMin.value) > Number(precioMax.value)) {
    errorPrecio.value = 'El precio mínimo debe ser menor o igual al máximo.';
    return;
  }
  aplicar({ precioMin: String(precioMin.value), precioMax: String(precioMax.value) });
}

function parametros(cursor) {
  const params = new URLSearchParams({ limite: '16' });
  for (const [campo, valor] of Object.entries(filtros.value)) if (valor) params.set(campo, valor);
  if (cursor) params.set('cursor', cursor);
  return params;
}

async function cargarProductos() {
  const actual = ++peticionActual;
  cargando.value = true;
  cargandoMas.value = false;
  error.value = '';
  try {
    const data = await api.get(`/productos?${parametros()}`);
    if (actual !== peticionActual) return;
    productos.value = data.items;
    cursorSiguiente.value = data.cursorSiguiente || null;
  } catch (e) {
    if (actual === peticionActual) error.value = e.message;
  } finally {
    if (actual === peticionActual) cargando.value = false;
  }
}

async function verMas() {
  if (!cursorSiguiente.value || cargandoMas.value) return;
  const actual = peticionActual;
  cargandoMas.value = true;
  error.value = '';
  try {
    const data = await api.get(`/productos?${parametros(cursorSiguiente.value)}`);
    if (actual !== peticionActual) return;
    const vistos = new Set(productos.value.map((producto) => producto.id));
    productos.value.push(...data.items.filter((producto) => !vistos.has(producto.id)));
    cursorSiguiente.value = data.cursorSiguiente || null;
  } catch (e) {
    if (actual === peticionActual) error.value = e.message;
  } finally {
    if (actual === peticionActual) cargandoMas.value = false;
  }
}

async function cargarRecomendaciones() {
  const actual = ++peticionRecomendaciones;
  recomendaciones.value = [];
  if (!sesion.usuario) return;
  try {
    const recs = await api.get('/recomendaciones');
    const detalles = await Promise.allSettled(recs.slice(0, 4).map((r) => api.get(`/productos/${r.idProducto}`)));
    if (actual !== peticionRecomendaciones) return;
    recomendaciones.value = detalles.flatMap((r, i) => r.status === 'fulfilled' ? [{ ...r.value, motivo: recs[i].motivo }] : []);
  } catch {
    if (actual === peticionRecomendaciones) recomendaciones.value = [];
  }
}

watch(filtros, (valor) => {
  precioMin.value = valor.precioMin;
  precioMax.value = valor.precioMax;
  cargarProductos();
}, { immediate: true });
watch(() => sesion.usuario?.id, cargarRecomendaciones, { immediate: true });
onMounted(async () => {
  try { categorias.value = aplanar(await api.get('/categorias')); } catch { categorias.value = []; }
});
</script>

<template>
  <template v-if="!activos">
    <section class="escaparate" aria-labelledby="titulo-tienda">
      <div class="escaparate-texto">
        <p class="origen"><span aria-hidden="true"></span> Mercado de Japón</p>
        <h1 id="titulo-tienda"><span>Descubre Japón</span> <span>a tu manera.</span></h1>
        <p>Cámaras, relojes, coleccionables y objetos de uso diario. Compra a precio fijo o encuentra una subasta.</p>
        <div class="escaparate-acciones">
          <RouterLink class="btn" :to="{ path: '/', hash: '#resultados' }">Explorar catálogo <Icono nombre="flecha" :tamano="17" /></RouterLink>
          <RouterLink class="btn secundario" :to="{ path: '/', query: { tipoVenta: 'subasta' }, hash: '#resultados' }">Ver subastas</RouterLink>
        </div>
      </div>
      <div class="escaparate-visual">
        <img class="escaparate-imagen" src="/catalogo/portada-japon.webp"
          alt="Cámara analógica, reloj de acero, cuenco japonés y cuadernos sobre una mesa" fetchpriority="high" />
      </div>
    </section>

    <section class="colecciones" aria-labelledby="titulo-colecciones">
      <h2 id="titulo-colecciones">Explora por categoría</h2>
      <div class="colecciones-rejilla">
        <RouterLink v-for="coleccion in colecciones" :key="coleccion.titulo" :to="enlaceColeccion(coleccion)" class="coleccion">
          <img :src="`/catalogo/${coleccion.imagen}.webp`" alt="" decoding="async" loading="lazy" />
          <span>{{ coleccion.titulo }}</span>
        </RouterLink>
      </div>
    </section>
  </template>

  <section id="resultados" class="catalogo" aria-labelledby="titulo-catalogo">
    <div class="encabezado-catalogo">
      <div>
        <h1 v-if="activos" id="titulo-catalogo">{{ filtros.q ? `Resultados para «${filtros.q}»` : filtros.tipoVenta === 'subasta' ? 'Subastas' : filtros.tipoVenta === 'fijo' ? 'Compra directa' : 'Catálogo' }}</h1>
        <h2 v-else id="titulo-catalogo">Catálogo</h2>
        <p v-if="!cargando && productos.length" aria-live="polite">{{ productos.length }} artículos mostrados</p>
      </div>
      <button class="btn secundario filtros-toggle" type="button" aria-controls="panel-filtros" :aria-expanded="filtroMovil" @click="filtroMovil = !filtroMovil">
        <Icono nombre="ajustes" :tamano="17" /> Filtros
      </button>
    </div>

    <div class="catalogo-layout">
      <aside id="panel-filtros" class="panel-filtros" :class="{ abierto: filtroMovil }" aria-label="Filtros del catálogo">
        <div class="titulo-filtros"><h3>Filtros</h3><RouterLink v-if="activos" :to="{ path: '/', hash: '#resultados' }">Restablecer</RouterLink></div>
        <div class="filtros">
          <label for="filtro-categoria">Categoría</label>
          <select id="filtro-categoria" :value="filtros.categoria" @change="aplicar({ categoria: $event.target.value })">
            <option value="">Todas</option>
            <option v-for="categoria in categorias" :key="categoria.id" :value="String(categoria.id)">{{ '— '.repeat(categoria.nivel) }}{{ categoria.nombre }}</option>
          </select>
          <label for="filtro-tipo">Modalidad</label>
          <select id="filtro-tipo" :value="filtros.tipoVenta" @change="aplicar({ tipoVenta: $event.target.value })">
            <option value="">Todas</option><option value="fijo">Compra directa</option><option value="subasta">Subasta</option>
          </select>
          <form class="precio-filtro" @submit.prevent="aplicarPrecio">
            <fieldset>
              <legend>Precio en USD</legend>
              <div class="precio-rango">
                <label>Mínimo<input v-model="precioMin" type="number" min="0" step="0.01" placeholder="0" /></label>
                <label>Máximo<input v-model="precioMax" type="number" min="0" step="0.01" placeholder="Sin límite" /></label>
              </div>
            </fieldset>
            <p v-if="errorPrecio" class="mensaje-error" role="alert">{{ errorPrecio }}</p>
            <button type="submit" class="btn secundario">Aplicar precio</button>
          </form>
        </div>
      </aside>

      <div class="resultados-catalogo">
        <div v-if="error" class="alerta error" role="alert">{{ error }} <button type="button" class="enlace-boton" @click="cargarProductos">Reintentar</button></div>
        <p v-if="cargando" class="estado-vista" role="status">Cargando catálogo…</p>
        <div v-else-if="!productos.length && !error" class="estado-vista">
          <h3>No hay productos que coincidan con los filtros.</h3>
          <RouterLink to="/" class="btn secundario">Ver todo el catálogo</RouterLink>
        </div>
        <div v-else class="rejilla">
          <ProductoCard v-for="producto in productos" :key="producto.id" :producto="producto" />
        </div>
        <div v-if="!cargando && cursorSiguiente" class="mas-productos">
          <button class="btn secundario" :disabled="cargandoMas" type="button" @click="verMas">{{ cargandoMas ? 'Cargando…' : 'Ver más productos' }} <Icono nombre="abajo" :tamano="16" /></button>
        </div>
      </div>
    </div>
  </section>

  <section v-if="!activos && recomendaciones.length" class="recomendaciones" aria-labelledby="titulo-recomendaciones">
    <h2 id="titulo-recomendaciones">Recomendado para ti</h2>
    <div class="recomendaciones-rejilla">
      <div v-for="producto in recomendaciones" :key="producto.id">
        <ProductoCard :producto="producto" />
        <p class="motivo-recomendacion">{{ producto.motivo }}</p>
      </div>
    </div>
  </section>
</template>
