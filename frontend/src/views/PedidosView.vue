<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';
import { usd, estadoPedido, fecha } from '../formato.js';
import Icono from '../components/Icono.vue';

const pedidos = ref([]);
const cursor = ref(null);
const cargando = ref(false);
const error = ref('');
async function cargar(pagina = null) {
  cargando.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ limite: '12' });
    if (pagina) params.set('cursor', pagina);
    const data = await api.get(`/pedidos?${params}`);
    pedidos.value = pagina ? [...pedidos.value, ...data.items] : data.items;
    cursor.value = data.cursorSiguiente;
  } catch (e) { error.value = e.message; }
  finally { cargando.value = false; }
}
onMounted(() => cargar());
</script>

<template>
  <header class="encabezado-pagina"><div><h1>Mis pedidos</h1><p>Consulta tus compras y ofertas registradas.</p></div></header>
  <div v-if="error" class="alerta error" role="alert">{{ error }} <button type="button" class="enlace-boton" @click="cargar()">Reintentar</button></div>
  <p v-if="cargando && !pedidos.length" class="estado-vista" role="status">Cargando pedidos…</p>
  <div v-else-if="!pedidos.length && !error" class="estado-vista">
    <Icono nombre="paquete" :tamano="30" /><h2>Todavía no tienes pedidos.</h2><RouterLink to="/" class="btn">Explorar catálogo</RouterLink>
  </div>
  <div v-else class="pedidos-lista">
    <article v-for="pedido in pedidos" :key="pedido.id" class="superficie pedido">
      <header><div><h2>{{ pedido.codigo }}</h2><p>{{ fecha(pedido.fechaCreacion) }}</p></div><span class="estado-pedido" :data-estado="pedido.estado">{{ estadoPedido(pedido.estado) }}</span></header>
      <div class="pedido-total"><span>Total del pedido</span><strong>{{ usd(pedido.totalUsd) }}</strong></div>
      <details>
        <summary>Ver detalle</summary>
        <dl class="desglose-compra"><div><dt>Subtotal</dt><dd>{{ usd(pedido.subtotalUsd) }}</dd></div><div><dt>Flete</dt><dd>{{ usd(pedido.fleteUsd) }}</dd></div><div><dt>Comisión</dt><dd>{{ usd(pedido.comisionUsd) }}</dd></div></dl>
        <ul v-if="pedido.detalle?.length"><li v-for="item in pedido.detalle" :key="item.idProducto"><RouterLink :to="`/productos/${item.idProducto}`">Ver artículo</RouterLink> · {{ item.cantidad }} {{ item.cantidad === 1 ? 'unidad' : 'unidades' }}</li></ul>
      </details>
    </article>
  </div>
  <div v-if="cursor" class="mas-productos"><button class="btn secundario" type="button" :disabled="cargando" @click="cargar(cursor)">Ver más pedidos</button></div>
</template>
