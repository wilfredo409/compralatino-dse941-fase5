<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const metricas = ref(null);
const cargando = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    metricas.value = await api.get('/admin/metricas');
  } catch (e) {
    error.value = e.status === 403
      ? 'Tu cuenta no tiene el rol de administrador (M5 · Administración).'
      : e.message;
  } finally {
    cargando.value = false;
  }
});
</script>

<template>
  <h2>Panel administrativo — CompraLatino</h2>
  <p v-if="cargando">Cargando métricas…</p>
  <div v-else-if="error" class="alerta error">{{ error }}</div>
  <div v-else-if="metricas">
    <p style="color:#666">Periodo: últimos {{ metricas.periodoDias }} días</p>

    <div class="kpis">
      <div class="kpi"><div class="lbl">Ventas del periodo</div><div class="val">USD {{ metricas.ventasUsd.toFixed(2) }}</div></div>
      <div class="kpi"><div class="lbl">Pedidos</div><div class="val">{{ metricas.pedidos }}</div></div>
      <div class="kpi"><div class="lbl">Ticket promedio</div><div class="val">USD {{ metricas.ticketPromedioUsd.toFixed(2) }}</div></div>
      <div class="kpi"><div class="lbl">Éxito de ofertas</div><div class="val">{{ metricas.exitoOfertasPorcentaje ?? '—' }}%</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="tarjeta">
        <h3>Salud de la integración con YAuctions</h3>
        <table>
          <tr><th>Indicador</th><th>Valor</th></tr>
          <tr><td>Circuito del adaptador</td><td><span class="pill" :class="metricas.integracionYAuctions.circuito">{{ metricas.integracionYAuctions.circuito }}</span></td></tr>
          <tr><td>Llamadas / fallos</td><td>{{ metricas.integracionYAuctions.llamadas }} / {{ metricas.integracionYAuctions.fallos }}</td></tr>
          <tr><td>Tasa de errores</td><td>{{ metricas.integracionYAuctions.tasaErrores }}%</td></tr>
          <tr><td>Latencia (última llamada)</td><td>{{ metricas.integracionYAuctions.latenciaMediaMs ?? '—' }} ms</td></tr>
        </table>
      </div>
      <div class="tarjeta">
        <h3>Tipo de cambio vigente y usuarios</h3>
        <table v-if="metricas.tipoCambioVigente">
          <tr><th>Par</th><th>Tasa</th><th>Margen</th></tr>
          <tr><td>{{ metricas.tipoCambioVigente.par }}</td><td>{{ metricas.tipoCambioVigente.tasa }}</td><td>{{ (metricas.tipoCambioVigente.margen * 100).toFixed(0) }}%</td></tr>
        </table>
        <table style="margin-top:10px">
          <tr><td>Usuarios registrados</td><td style="text-align:right">{{ metricas.usuarios.registrados }}</td></tr>
          <tr><td>Nuevos (periodo)</td><td style="text-align:right">{{ metricas.usuarios.nuevos }}</td></tr>
        </table>
      </div>
    </div>

    <div class="tarjeta">
      <h3>Pedidos que requieren atención</h3>
      <p v-if="!metricas.pedidosQueRequierenAtencion.length" style="color:#888">Ninguno por ahora.</p>
      <table v-else>
        <tr><th>Pedido</th><th>Cliente</th><th>Motivo</th><th>Antigüedad</th><th>Monto</th></tr>
        <tr v-for="p in metricas.pedidosQueRequierenAtencion" :key="p.codigo">
          <td>{{ p.codigo }}</td><td>{{ p.cliente }}</td><td>{{ p.motivo }}</td>
          <td>{{ p.antiguedadHoras }} h</td><td>USD {{ p.montoUsd.toFixed(2) }}</td>
        </tr>
      </table>
    </div>

    <p style="margin-top:16px">
      <a class="btn secundario" href="/api/v1/admin/reportes/transacciones" target="_blank" rel="noopener">
        Exportar reporte de transacciones (CSV)
      </a>
    </p>
  </div>
</template>
