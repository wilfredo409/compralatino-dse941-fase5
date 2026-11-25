<script setup>
import { computed, ref, watch } from 'vue';
import { api } from '../api.js';
import { sesion } from '../store/auth.js';
import { imagenPlaceholder } from '../placeholder.js';
import { usd, jpy, fechaConHora } from '../formato.js';
import Icono from '../components/Icono.vue';
import DireccionFields from '../components/DireccionFields.vue';

const props = defineProps({ id: { type: String, required: true } });
const producto = ref(null);
const cargando = ref(true);
const errorCarga = ref('');
const error = ref('');
const exito = ref('');
const enviando = ref(false);
const fotoActiva = ref(0);
const montoJpy = ref(0);
const direccionFaltante = ref(false);
const nuevaDireccion = ref({ pais: 'El Salvador', departamento: '', ciudad: '', detalle: '' });
let peticionActual = 0;

const subasta = computed(() => producto.value?.tipoVenta === 'subasta');
const cerrada = computed(() => Boolean(subasta.value && producto.value.fechaFinSubasta && new Date(producto.value.fechaFinSubasta).getTime() <= Date.now()));
const imagenes = computed(() => producto.value?.imagenes?.length ? producto.value.imagenes : [imagenPlaceholder(producto.value?.titulo)]);
const parrafos = computed(() => (producto.value?.descripcion || '').split(/\n\s*\n/).filter(Boolean));

async function cargar() {
  const actual = ++peticionActual;
  cargando.value = true;
  producto.value = null;
  errorCarga.value = '';
  error.value = '';
  exito.value = '';
  fotoActiva.value = 0;
  direccionFaltante.value = false;
  try {
    const detalle = await api.get(`/productos/${props.id}`);
    if (actual !== peticionActual) return;
    producto.value = detalle;
    montoJpy.value = Math.max(1, Math.round(detalle.precioJpy));
  } catch (e) {
    if (actual === peticionActual) errorCarga.value = e.message;
  } finally {
    if (actual === peticionActual) cargando.value = false;
  }
}

watch(() => props.id, cargar, { immediate: true });

async function guardarDireccion() {
  error.value = '';
  enviando.value = true;
  try {
    const perfil = await api.get('/usuarios/me');
    await api.put('/usuarios/me', {
      nombre: perfil.nombre, apellido: perfil.apellido, telefono: perfil.telefono,
      direcciones: [...perfil.direcciones, { ...nuevaDireccion.value, esPrincipal: !perfil.direcciones.length }],
    });
    direccionFaltante.value = false;
  } catch (e) {
    error.value = e.message;
  } finally {
    enviando.value = false;
  }
}

async function iniciarOperacion() {
  if (enviando.value || exito.value) return;
  error.value = '';
  if (subasta.value && producto.value.fechaFinSubasta && Date.parse(producto.value.fechaFinSubasta) <= Date.now()) {
    error.value = 'La subasta ya cerró.';
    return;
  }
  enviando.value = true;
  let pedido;
  try {
    const perfil = await api.get('/usuarios/me');
    const dir = perfil.direcciones.find((item) => item.esPrincipal) || perfil.direcciones[0];
    if (!dir) {
      direccionFaltante.value = true;
      return;
    }
    pedido = await api.post('/pedidos', { idDireccion: dir.id, items: [{ idProducto: producto.value.id, cantidad: 1 }] });
    if (subasta.value) {
      await api.post(`/pedidos/${pedido.id}/ofertas`, { idProducto: producto.value.id, montoJpy: montoJpy.value });
      exito.value = `Puja registrada en el pedido ${pedido.codigo}.`;
    } else {
      await api.post(`/pedidos/${pedido.id}/pago`, { proveedor: 'demo-gateway', tokenPago: `tok_demo_${pedido.id}` });
      exito.value = `Compra confirmada. Pedido ${pedido.codigo}.`;
    }
  } catch (e) {
    const mensaje = e.status === 503 ? 'La integración de subastas está temporalmente indisponible.' : e.message;
    if (pedido) {
      error.value = `${mensaje} El pedido ${pedido.codigo} quedó registrado. Consulta su estado en Mis pedidos.`;
      exito.value = 'Consulta el pedido antes de repetir la operación.';
    } else {
      error.value = mensaje;
    }
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <RouterLink class="enlace-volver" :to="{ path: '/', hash: '#resultados' }"><Icono nombre="volver" :tamano="17" /> Volver al catálogo</RouterLink>
  <p v-if="cargando" class="estado-vista" role="status">Cargando producto…</p>
  <div v-else-if="errorCarga" class="estado-vista" role="alert"><h1>{{ errorCarga }}</h1></div>
  <article v-else-if="producto" class="detalle-producto">
    <div class="detalle-galeria">
      <img class="detalle-imagen" :src="imagenes[fotoActiva]" :alt="producto.titulo" fetchpriority="high" />
      <p v-if="producto.idExternoYa?.startsWith('DEMO-JP-')" class="imagen-referencia">Imagen de referencia del catálogo de demostración.</p>
      <div v-if="imagenes.length > 1" class="detalle-miniaturas" aria-label="Imágenes del artículo">
        <button v-for="(imagen, indice) in imagenes" :key="imagen" type="button" :aria-label="`Ver imagen ${indice + 1}`" :aria-pressed="fotoActiva === indice" @click="fotoActiva = indice">
          <img :src="imagen" alt="" />
        </button>
      </div>
    </div>

    <div class="detalle-informacion">
      <span class="etiqueta" :class="{ subasta }">{{ subasta ? 'Subasta' : 'Compra directa' }}</span>
      <h1>{{ producto.titulo }}</h1>
      <p v-if="parrafos[0]" class="detalle-resumen">{{ parrafos[0] }}</p>

      <section class="panel-compra" :aria-label="subasta ? 'Pujar por el artículo' : 'Comprar el artículo'">
        <template v-if="subasta">
          <p class="producto-precio-label">Precio de referencia</p>
          <strong class="precio precio-grande">{{ jpy(producto.precioJpy) }}</strong>
          <p class="detalle-disponibilidad">
            {{ cerrada ? 'Subasta cerrada' : producto.fechaFinSubasta ? `Cierre: ${fechaConHora(producto.fechaFinSubasta)}` : 'Cierre sin confirmar' }}
          </p>
        </template>
        <template v-else>
          <p class="producto-precio-label">Precio del artículo en USD</p>
          <strong class="precio precio-grande">{{ usd(producto.precioUsd) }}</strong>
          <p class="detalle-disponibilidad" :class="{ indisponible: !producto.stock }">{{ producto.stock ? `${producto.stock} disponibles` : 'Sin stock' }}</p>
          <dl v-if="producto.estimacionCompra" class="desglose-compra">
            <div><dt>Artículo</dt><dd>{{ usd(producto.estimacionCompra.subtotalUsd) }}</dd></div>
            <div><dt>Flete</dt><dd>{{ usd(producto.estimacionCompra.fleteUsd) }}</dd></div>
            <div><dt>Comisión</dt><dd>{{ usd(producto.estimacionCompra.comisionUsd) }}</dd></div>
            <div><dt>Total en USD</dt><dd>{{ usd(producto.estimacionCompra.totalUsd) }}</dd></div>
          </dl>
        </template>

        <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
        <p v-if="exito && !error" class="alerta exito" role="status">{{ exito }}</p>
        <RouterLink v-if="exito" to="/mis-pedidos" class="btn">Ver mis pedidos <Icono nombre="flecha" :tamano="17" /></RouterLink>
        <template v-else-if="subasta ? !cerrada : producto.stock > 0 && producto.precioUsd !== null">
          <RouterLink v-if="!sesion.usuario" class="btn accion-compra" :to="{ path: '/ingresar', query: { redirigirA: `/productos/${id}` } }">
            {{ subasta ? 'Ingresar para pujar' : 'Ingresar para comprar' }}
          </RouterLink>
          <form v-else-if="direccionFaltante" class="form" @submit.prevent="guardarDireccion">
            <h3>Ingresa una dirección de envío</h3>
            <DireccionFields prefix="direccion" v-model="nuevaDireccion" />
            <button type="submit" class="btn" :disabled="enviando">Guardar dirección</button>
          </form>
          <form v-else-if="subasta" class="form oferta" @submit.prevent="iniciarOperacion">
            <label for="oferta-jpy">Tu puja en JPY</label>
            <input id="oferta-jpy" type="number" v-model.number="montoJpy" min="1" step="1" required />
            <button type="submit" class="btn accion-compra" :disabled="enviando">{{ enviando ? 'Enviando…' : 'Pujar en YAuctions' }}</button>
          </form>
          <button v-else type="button" class="btn accion-compra" :disabled="enviando" @click="iniciarOperacion">{{ enviando ? 'Procesando…' : 'Comprar ahora' }}</button>
        </template>
        <p v-if="producto.idExternoYa?.startsWith('DEMO-JP-')" class="texto-secundario demo-pago">Operación simulada para la demostración.</p>
      </section>
    </div>

    <section class="detalle-descripcion" aria-labelledby="titulo-descripcion">
      <h2 id="titulo-descripcion">Detalles del artículo</h2>
      <p v-for="parrafo in parrafos.slice(1)" :key="parrafo">{{ parrafo }}</p>
      <p v-if="parrafos.length === 1">{{ parrafos[0] }}</p>
      <p v-if="!parrafos.length">La ficha de este artículo se actualizará cuando haya más datos disponibles.</p>
      <dl class="detalle-datos">
        <div><dt>Modalidad</dt><dd>{{ subasta ? 'Subasta' : 'Compra directa' }}</dd></div>
        <div><dt>Referencia</dt><dd>{{ producto.idExternoYa }}</dd></div>
        <div><dt>Precio de referencia en Japón</dt><dd>{{ jpy(producto.precioJpy) }}</dd></div>
      </dl>
    </section>
  </article>
</template>
