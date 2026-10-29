<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const pedidos = ref([]);
const cargando = ref(true);

const estadoTexto = {
  creado: 'Creado', pagado: 'Pagado', en_proceso: 'En proceso',
  enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};

onMounted(async () => {
  const data = await api.get('/pedidos');
  pedidos.value = data.items;
  cargando.value = false;
});
</script>

<template>
  <h2>Mis pedidos</h2>
  <p v-if="cargando">Cargando…</p>
  <p v-else-if="!pedidos.length">Todavía no tienes pedidos.</p>
  <table v-else class="tabla-pedidos">
    <thead>
      <tr><th>Código</th><th>Estado</th><th>Subtotal</th><th>Flete</th><th>Comisión</th><th>Total</th><th>Fecha</th></tr>
    </thead>
    <tbody>
      <tr v-for="p in pedidos" :key="p.id">
        <td data-label="Código">{{ p.codigo }}</td>
        <td data-label="Estado">{{ estadoTexto[p.estado] || p.estado }}</td>
        <td data-label="Subtotal">USD {{ p.subtotalUsd.toFixed(2) }}</td>
        <td data-label="Flete">USD {{ p.fleteUsd.toFixed(2) }}</td>
        <td data-label="Comisión">USD {{ p.comisionUsd.toFixed(2) }}</td>
        <td data-label="Total"><strong>USD {{ p.totalUsd.toFixed(2) }}</strong></td>
        <td data-label="Fecha">{{ new Date(p.fechaCreacion).toLocaleString('es-SV') }}</td>
      </tr>
    </tbody>
  </table>
</template>
