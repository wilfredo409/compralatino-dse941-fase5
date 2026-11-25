<script setup>
import { computed } from 'vue';
import { imagenPlaceholder } from '../placeholder.js';
import { usd, jpy } from '../formato.js';
import Icono from './Icono.vue';

const props = defineProps({ producto: { type: Object, required: true } });
const esSubasta = computed(() => props.producto.tipoVenta === 'subasta');
const resumen = computed(() => props.producto.resumen || props.producto.descripcion || '');
</script>

<template>
  <RouterLink :to="`/productos/${producto.id}`" class="tarjeta producto-card">
    <div class="producto-miniatura">
      <img :src="producto.imagenes?.[0] || imagenPlaceholder(producto.titulo)" :alt="producto.titulo" loading="lazy" decoding="async" />
      <span class="etiqueta" :class="{ subasta: esSubasta }">{{ esSubasta ? 'Subasta' : 'Compra directa' }}</span>
    </div>
    <div class="producto-card-cuerpo">
      <h3>{{ producto.titulo }}</h3>
      <p v-if="resumen" class="producto-resumen">{{ resumen }}</p>
      <div class="producto-card-final">
        <div>
          <span v-if="esSubasta" class="producto-precio-label">Referencia de subasta</span>
          <strong class="precio">{{ esSubasta ? jpy(producto.precioJpy) : usd(producto.precioUsd) }}</strong>
        </div>
        <span class="producto-ver" aria-hidden="true"><Icono nombre="flecha" :tamano="17" /></span>
      </div>
    </div>
  </RouterLink>
</template>
