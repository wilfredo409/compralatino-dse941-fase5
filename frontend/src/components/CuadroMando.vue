<script setup>
import { computed, ref, watch } from 'vue';
import { api } from '../api.js';

const dias = ref(30);
const cambio = ref(0);
const datos = ref(null);
const cargando = ref(true);
const error = ref('');
const usd = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const moneda = (valor) => usd.format(valor);
const porcentaje = (valor) => valor === null ? 'Sin datos' : `${valor} %`;
const indicadores = [
  { nombre: 'Ventas por pedidos confirmados', perspectiva: 'Financiera', campo: 'ventasUsd', formato: moneda },
  { nombre: 'Compradores recurrentes', perspectiva: 'Clientes', campo: 'compradoresRecurrentesPorcentaje', formato: porcentaje },
  { nombre: 'Pedidos entregados', perspectiva: 'Procesos internos', campo: 'pedidosEntregadosPorcentaje', formato: porcentaje },
];
const escenario = computed(() => datos.value ? datos.value.actual.ventasUsd * (1 + cambio.value / 100) : 0);

watch(dias, async (periodo, previo, invalidar) => {
  let vigente = true;
  invalidar(() => { vigente = false; });
  cargando.value = true;
  error.value = '';
  try {
    const resultado = await api.get(`/admin/cuadro-mando?dias=${periodo}`);
    if (vigente) datos.value = resultado;
  } catch (e) {
    if (vigente) error.value = e.message;
  } finally {
    if (vigente) cargando.value = false;
  }
}, { immediate: true });
</script>

<template>
  <section class="tarjeta cuadro" aria-labelledby="titulo-cuadro">
    <h3 id="titulo-cuadro">Cuadro de mando ejecutivo</h3>
    <label for="periodo-cuadro">Periodo de análisis</label>
    <select id="periodo-cuadro" v-model.number="dias">
      <option :value="7">7 días</option>
      <option :value="30">30 días</option>
      <option :value="90">90 días</option>
    </select>
    <p v-if="cargando" role="status">Cargando indicadores…</p>
    <p v-else-if="error" role="alert" class="alerta error">{{ error }}</p>
    <template v-else-if="datos">
      <div class="tabla-scroll">
        <table>
          <thead><tr><th scope="col">Perspectiva e indicador</th><th scope="col">Periodo actual</th><th scope="col">Periodo anterior</th></tr></thead>
          <tbody>
            <tr v-for="i in indicadores" :key="i.campo">
              <th scope="row"><small>{{ i.perspectiva }}</small><br>{{ i.nombre }}</th>
              <td>{{ i.formato(datos.actual[i.campo]) }}</td>
              <td>{{ i.formato(datos.anterior[i.campo]) }}</td>
            </tr>
            <tr>
              <th scope="row"><small>Aprendizaje y crecimiento</small><br>Personal capacitado para operar la plataforma</th>
              <td colspan="2">Medición en la bitácora de capacitación</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>{{ datos.actual.compradores }} compradores y {{ datos.actual.pedidos }} pedidos confirmados en el periodo actual.</p>
      <label for="cambio-ventas">Simular variación de ventas ({{ cambio }} %)</label>
      <input id="cambio-ventas" v-model.number="cambio" type="range" min="-40" max="40" step="5">
      <p>Ventas del escenario <strong>{{ moneda(escenario) }}</strong>. Los demás factores permanecen constantes.</p>
    </template>
  </section>
</template>

<style scoped>
.cuadro select { display: block; max-width: 12rem; margin: .4rem 0 1rem; }
.cuadro .tabla-scroll { overflow-x: auto; }
.cuadro input[type="range"] { display: block; max-width: 24rem; }
</style>
