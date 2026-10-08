<script setup>
import { imagenPlaceholder } from '../placeholder.js';
defineProps({ producto: { type: Object, required: true } });
</script>

<template>
  <RouterLink :to="`/productos/${producto.id}`" class="tarjeta" style="text-decoration:none;color:inherit;display:block">
    <img :src="producto.imagenes?.[0] || imagenPlaceholder(producto.titulo)" :alt="producto.titulo" />
    <h3>{{ producto.titulo }}</h3>
    <div class="precio">USD {{ producto.precioUsd?.toFixed(2) ?? '—' }}</div>
    <div style="font-size:11px;color:#888">JPY {{ producto.precioJpy?.toLocaleString('es-SV') }}</div>
    <span class="etiqueta" :class="{ subasta: producto.tipoVenta === 'subasta' }">
      {{ producto.tipoVenta === 'subasta' ? 'Subasta' : 'Compra directa' }}
    </span>
  </RouterLink>
</template>
