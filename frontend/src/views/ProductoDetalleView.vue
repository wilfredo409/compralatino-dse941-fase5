<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { sesion } from '../store/auth.js';
import { imagenPlaceholder } from '../placeholder.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const producto = ref(null);
const cargando = ref(true);
const error = ref('');
const exito = ref('');
const enviando = ref(false);
const montoJpy = ref(0);
const direccionFaltante = ref(false);
const nuevaDireccion = ref({ pais: 'El Salvador', departamento: '', ciudad: '', detalle: '' });

async function cargar() {
  cargando.value = true;
  try {
    producto.value = await api.get(`/productos/${props.id}`);
    montoJpy.value = Math.round(producto.value.precioJpy * 0.9); // oferta inicial sugerida: 90% del precio de referencia
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
onMounted(cargar);

async function direccionPrincipal() {
  const perfil = await api.get('/usuarios/me');
  return perfil.direcciones?.[0] || null;
}

async function guardarDireccion() {
  const perfil = await api.get('/usuarios/me');
  await api.put('/usuarios/me', {
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    telefono: perfil.telefono,
    direcciones: [{ ...nuevaDireccion.value, esPrincipal: true }],
  });
  direccionFaltante.value = false;
}

async function comprarAhora() {
  error.value = ''; exito.value = '';
  const dir = await direccionPrincipal();
  if (!dir) { direccionFaltante.value = true; return; }

  enviando.value = true;
  try {
    const pedido = await api.post('/pedidos', {
      idDireccion: dir.id,
      items: [{ idProducto: producto.value.id, cantidad: 1 }],
    });
    await api.post(`/pedidos/${pedido.id}/pago`, { proveedor: 'demo-gateway', tokenPago: `tok_demo_${Date.now()}` });
    exito.value = `Compra confirmada — pedido ${pedido.codigo}.`;
    setTimeout(() => router.push('/mis-pedidos'), 1200);
  } catch (e) {
    error.value = e.message;
  } finally {
    enviando.value = false;
  }
}

async function enviarOferta() {
  error.value = ''; exito.value = '';
  const dir = await direccionPrincipal();
  if (!dir) { direccionFaltante.value = true; return; }

  enviando.value = true;
  try {
    const pedido = await api.post('/pedidos', {
      idDireccion: dir.id,
      items: [{ idProducto: producto.value.id, cantidad: 1 }],
    });
    const oferta = await api.post(`/pedidos/${pedido.id}/ofertas`, {
      idProducto: producto.value.id,
      montoJpy: montoJpy.value,
    });
    exito.value = `Oferta enviada a YAuctions (pedido ${pedido.codigo}, estado: ${oferta.estado}).`;
  } catch (e) {
    if (e.status === 503) {
      error.value = 'YAuctions no está disponible en este momento (circuito del adaptador abierto). Intenta de nuevo en unos segundos.';
    } else {
      error.value = e.message;
    }
  } finally {
    enviando.value = false;
  }
}

const requiereSesion = computed(() => !sesion.usuario);
</script>

<template>
  <p v-if="cargando">Cargando producto…</p>
  <div v-else-if="error" class="alerta error">
    {{ error }}
    <p><RouterLink to="/">Volver al catálogo</RouterLink></p>
  </div>
  <div v-else-if="producto">
    <RouterLink to="/">&larr; Volver al catálogo</RouterLink>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:14px">
      <img :src="producto.imagenes?.[0] || imagenPlaceholder(producto.titulo)" :alt="producto.titulo" style="width:320px;border-radius:8px" />
      <div style="flex:1;min-width:260px">
        <h2>{{ producto.titulo }}</h2>
        <p style="color:#555">{{ producto.descripcion }}</p>
        <div class="precio" style="font-size:26px">USD {{ producto.precioUsd?.toFixed(2) }}</div>
        <div style="color:#888;margin-bottom:8px">JPY {{ producto.precioJpy.toLocaleString('es-SV') }} · tasa incl. margen de intermediación</div>
        <span class="etiqueta" :class="{ subasta: producto.tipoVenta === 'subasta' }">
          {{ producto.tipoVenta === 'subasta' ? 'Subasta' : 'Compra directa' }}
        </span>
        <p v-if="producto.tipoVenta === 'fijo'" style="margin-top:6px;font-size:13px;color:#555">Stock disponible: {{ producto.stock }}</p>
        <p v-else style="margin-top:6px;font-size:13px;color:#555">Cierra: {{ new Date(producto.fechaFinSubasta).toLocaleString('es-SV') }}</p>

        <div v-if="exito" class="alerta exito" style="margin-top:16px">{{ exito }}</div>
        <div v-if="error" class="alerta error" style="margin-top:16px">{{ error }}</div>

        <p v-if="requiereSesion" style="margin-top:16px">
          <RouterLink class="btn" :to="{ path: '/ingresar', query: { redirigirA: `/productos/${producto.id}` } }">Inicia sesión para continuar</RouterLink>
        </p>

        <template v-else>
          <div v-if="direccionFaltante" class="form" style="margin-top:16px;border:1px solid #ddd;padding:14px;border-radius:8px">
            <strong>Agrega una dirección de envío para continuar</strong>
            <label>País</label><input v-model="nuevaDireccion.pais" />
            <label>Departamento</label><input v-model="nuevaDireccion.departamento" />
            <label>Ciudad</label><input v-model="nuevaDireccion.ciudad" />
            <label>Detalle</label><input v-model="nuevaDireccion.detalle" />
            <button class="btn" @click="guardarDireccion">Guardar dirección</button>
          </div>

          <div v-else-if="producto.tipoVenta === 'fijo'" style="margin-top:16px">
            <button class="btn" :disabled="enviando || producto.stock < 1" @click="comprarAhora">
              {{ producto.stock < 1 ? 'Sin stock' : (enviando ? 'Procesando…' : 'Comprar ahora') }}
            </button>
          </div>

          <div v-else style="margin-top:16px;display:flex;gap:8px;align-items:center">
            <label>Oferta (JPY)</label>
            <input type="number" v-model.number="montoJpy" min="1" style="width:140px;padding:8px;border:1px solid #ddd;border-radius:6px" />
            <button class="btn" :disabled="enviando" @click="enviarOferta">{{ enviando ? 'Enviando…' : 'Enviar oferta a YAuctions' }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
