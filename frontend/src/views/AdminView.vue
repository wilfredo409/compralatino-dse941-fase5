<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import { sesion } from '../store/auth.js';
import { usd, fecha, fechaConHora, estadoPedido } from '../formato.js';
import CuadroMando from '../components/CuadroMando.vue';
import Icono from '../components/Icono.vue';

const route = useRoute();
const vistas = [
  { clave: 'resumen', titulo: 'Resumen', icono: 'tablero' },
  { clave: 'pedidos', titulo: 'Pedidos', icono: 'paquete' },
  { clave: 'usuarios', titulo: 'Usuarios', icono: 'usuario' },
  { clave: 'reportes', titulo: 'Reportes', icono: 'documento' },
  { clave: 'auditoria', titulo: 'Auditoría', icono: 'historial' },
];
const vista = computed(() => vistas.find((item) => item.clave === route.params.vista) || vistas[0]);
const metricas = ref(null);
const cargando = ref(false);
const error = ref('');
const mensaje = ref('');
const registros = ref([]);
const cursor = ref(null);
const filtroEstado = ref('');
const desde = ref('');
const hasta = ref('');
const exportando = ref(false);
const editandoUsuario = ref(null);
let peticion = 0;

const opcionesPedido = ['creado','pagado','en_proceso','enviado','entregado','cancelado'];
const opcionesUsuario = [['activo','Activo'],['suspendido','Suspendido'],['pendiente_verificacion','Pendiente de verificación']];

async function cargar(siguiente = null) {
  const actual = ++peticion;
  const clave = vista.value.clave;
  error.value = '';
  mensaje.value = '';
  if (!siguiente) { registros.value = []; cursor.value = null; }
  if (!sesion.esAdmin || clave === 'reportes') { cargando.value = false; return; }

  cargando.value = true;
  try {
    if (clave === 'resumen') {
      const data = await api.get('/admin/metricas');
      if (actual === peticion) metricas.value = data;
    } else {
      const params = new URLSearchParams({ limite: '15' });
      if (siguiente) params.set('cursor', siguiente);
      if (clave === 'pedidos' && filtroEstado.value) params.set('estado', filtroEstado.value);
      const data = await api.get(`/admin/${clave}?${params}`);
      if (actual !== peticion) return;
      registros.value = siguiente ? [...registros.value, ...data.items] : data.items;
      cursor.value = data.cursorSiguiente;
    }
  } catch (e) {
    if (actual === peticion) error.value = e.message;
  } finally {
    if (actual === peticion) cargando.value = false;
  }
}

watch([() => vista.value.clave, filtroEstado], () => cargar(), { immediate: true });

async function cambiarEstado(usuario, event) {
  const estado = event.target.value;
  const campo = event.target;
  if (estado === usuario.estado) return;
  editandoUsuario.value = usuario.id;
  error.value = '';
  mensaje.value = '';
  try {
    const actualizado = await api.put('/admin/usuarios', { id: usuario.id, estado });
    Object.assign(usuario, actualizado);
    mensaje.value = 'Estado del usuario actualizado.';
  } catch (e) {
    campo.value = usuario.estado;
    error.value = e.message;
  } finally {
    editandoUsuario.value = null;
  }
}

async function exportarTransacciones() {
  if (desde.value && hasta.value && desde.value > hasta.value) {
    error.value = 'La fecha inicial debe ser anterior o igual a la fecha final.';
    return;
  }
  error.value = '';
  exportando.value = true;
  try {
    const params = new URLSearchParams();
    if (desde.value) params.set('desde', desde.value);
    if (hasta.value) params.set('hasta', hasta.value);
    const csv = await api.get(`/admin/reportes/transacciones?${params}`);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'transacciones.csv';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { error.value = e.message; }
  finally { exportando.value = false; }
}
</script>

<template>
  <div v-if="!sesion.esAdmin" class="estado-vista" role="alert">
    <h1>Acceso restringido</h1><p>Tu cuenta no tiene el rol de administrador.</p><RouterLink class="btn" to="/">Volver al catálogo</RouterLink>
  </div>
  <div v-else class="admin-layout">
    <aside class="admin-lateral">
      <h2>Administración</h2>
      <nav aria-label="Administración">
        <RouterLink v-for="pestana in vistas" :key="pestana.clave" :to="pestana.clave === 'resumen' ? '/admin' : `/admin/${pestana.clave}`"
          :aria-current="vista.clave === pestana.clave ? 'page' : undefined">
          <Icono :nombre="pestana.icono" :tamano="18" /> {{ pestana.titulo }}
        </RouterLink>
      </nav>
    </aside>
    <section class="admin-principal">
      <header class="encabezado-pagina">
        <div><h1>{{ vista.titulo }}</h1><p v-if="vista.clave === 'resumen'">Actividad de CompraLatino en los últimos {{ metricas?.periodoDias || 30 }} días</p></div>
        <RouterLink v-if="vista.clave === 'resumen'" to="/admin/reportes" class="btn secundario">Ver reportes <Icono nombre="flecha" :tamano="17" /></RouterLink>
      </header>
      <div v-if="error" class="alerta error" role="alert">{{ error }}</div>
      <p v-if="mensaje" class="alerta exito" role="status">{{ mensaje }}</p>

      <template v-if="vista.clave === 'resumen'">
        <p v-if="cargando && !metricas" class="estado-vista" role="status">Cargando métricas…</p>
        <template v-if="metricas">
          <div class="kpis">
            <div class="kpi"><span>Ventas</span><strong>{{ usd(metricas.ventasUsd) }}</strong></div>
            <div class="kpi"><span>Pedidos</span><strong>{{ metricas.pedidos }}</strong></div>
            <div class="kpi"><span>Ticket promedio</span><strong>{{ usd(metricas.ticketPromedioUsd) }}</strong></div>
            <div class="kpi"><span>Éxito de ofertas</span><strong>{{ metricas.exitoOfertasPorcentaje === null ? '—' : `${metricas.exitoOfertasPorcentaje} %` }}</strong></div>
          </div>
          <div class="admin-metricas">
            <section class="superficie">
              <h2>Salud de la integración con YAuctions</h2>
              <dl class="datos-admin"><div><dt>Circuito</dt><dd>{{ metricas.integracionYAuctions.circuito }}</dd></div><div><dt>Llamadas</dt><dd>{{ metricas.integracionYAuctions.llamadas }}</dd></div><div><dt>Fallos</dt><dd>{{ metricas.integracionYAuctions.fallos }}</dd></div><div><dt>Última latencia</dt><dd>{{ metricas.integracionYAuctions.latenciaMediaMs == null ? '—' : `${metricas.integracionYAuctions.latenciaMediaMs} ms` }}</dd></div></dl>
            </section>
            <section class="superficie">
              <h2>Cuentas y tipo de cambio</h2>
              <dl class="datos-admin"><div><dt>Usuarios registrados</dt><dd>{{ metricas.usuarios.registrados }}</dd></div><div><dt>Nuevos en el periodo</dt><dd>{{ metricas.usuarios.nuevos }}</dd></div><div v-if="metricas.tipoCambioVigente"><dt>JPY por USD</dt><dd>{{ metricas.tipoCambioVigente.tasa }}</dd></div><div v-if="metricas.tipoCambioVigente"><dt>Margen</dt><dd>{{ (metricas.tipoCambioVigente.margen * 100).toFixed(0) }} %</dd></div></dl>
            </section>
          </div>
          <section class="superficie">
            <div class="encabezado-seccion"><h2>Pedidos que requieren atención</h2><RouterLink to="/admin/pedidos">Ver pedidos</RouterLink></div>
            <p v-if="!metricas.pedidosQueRequierenAtencion.length" class="texto-secundario">No hay pedidos en esta lista.</p>
            <div v-else class="tabla-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Motivo</th><th>Importe</th></tr></thead><tbody>
              <tr v-for="pedido in metricas.pedidosQueRequierenAtencion" :key="pedido.codigo">
                <td>{{ pedido.codigo }}</td><td>{{ pedido.cliente }}</td><td>{{ pedido.motivo }}</td><td>{{ usd(pedido.montoUsd) }}</td>
              </tr>
            </tbody></table></div>
          </section>
          <CuadroMando />
        </template>
      </template>

      <section v-else-if="vista.clave === 'reportes'" class="superficie">
        <h2>Transacciones</h2><p class="texto-secundario">Elige un periodo para descargar el reporte en CSV.</p>
        <form class="form reporte-form" @submit.prevent="exportarTransacciones">
          <div class="form-columnas">
            <label>Desde<input v-model="desde" type="date" /></label>
            <label>Hasta<input v-model="hasta" type="date" /></label>
          </div>
          <button type="submit" class="btn" :disabled="exportando">{{ exportando ? 'Exportando…' : 'Exportar transacciones (CSV)' }}</button>
        </form>
      </section>

      <section v-else class="superficie">
        <div v-if="vista.clave === 'pedidos'" class="admin-filtro"><label for="admin-estado">Estado del pedido</label>
          <select id="admin-estado" v-model="filtroEstado"><option value="">Todos</option><option v-for="estado in opcionesPedido" :key="estado" :value="estado">{{ estadoPedido(estado) }}</option></select>
        </div>

        <p v-if="cargando && !registros.length" class="estado-vista" role="status">Cargando…</p>
        <p v-else-if="!registros.length && !error" class="texto-secundario">No hay registros para mostrar.</p>
        <div v-if="registros.length" class="tabla-scroll">
          <table v-if="vista.clave === 'pedidos'">
            <thead><tr><th>Pedido</th><th>Estado</th><th>Total</th><th>Fecha</th></tr></thead>
            <tbody><tr v-for="pedido in registros" :key="pedido.id"><td>{{ pedido.codigo }}</td><td><span class="estado-pedido" :data-estado="pedido.estado">{{ estadoPedido(pedido.estado) }}</span></td><td>{{ usd(pedido.totalUsd) }}</td><td>{{ fecha(pedido.fechaCreacion) }}</td></tr></tbody>
          </table>
          <table v-else-if="vista.clave === 'usuarios'">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th></tr></thead>
            <tbody><tr v-for="usuario in registros" :key="usuario.id">
              <td>{{ usuario.nombre }} {{ usuario.apellido }}</td><td>{{ usuario.email }}</td>
              <td><select :aria-label="`Estado de ${usuario.email}`" :value="usuario.estado" :disabled="editandoUsuario !== null || usuario.id === sesion.usuario?.id" @change="cambiarEstado(usuario, $event)"><option v-for="opcion in opcionesUsuario" :key="opcion[0]" :value="opcion[0]">{{ opcion[1] }}</option></select></td>
            </tr></tbody>
          </table>
          <table v-else>
            <thead><tr><th>Acción</th><th>Entidad</th><th>Registro</th><th>Fecha</th></tr></thead>
            <tbody><tr v-for="registro in registros" :key="registro.id"><td>{{ registro.accion }}</td><td>{{ registro.entidad }}</td><td>{{ registro.idEntidad || '—' }}</td><td>{{ fechaConHora(registro.fecha) }}</td></tr></tbody>
          </table>
        </div>
        <div v-if="cursor" class="mas-productos"><button class="btn secundario" type="button" :disabled="cargando" @click="cargar(cursor)">Ver más</button></div>
      </section>
    </section>
  </div>
</template>
