<script setup>
defineProps({ nombre: { type: String, required: true }, tamano: { type: Number, default: 20 } });
const trazos = {
  buscar: ['m21 21-4.3-4.3', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'],
  usuario: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  paquete: ['M21 8v8l-9 5-9-5V8l9-5 9 5Z', 'm3 8 9 5 9-5', 'M12 13v8', 'm7.5 5.5 9 5'],
  inicio: ['m3 10 9-7 9 7v10H3Z', 'M9 20v-6h6v6'],
  flecha: ['M4 12h15', 'm13 6 6 6-6 6'],
  volver: ['M20 12H5', 'm11 6-6 6 6 6'],
  abajo: ['m6 9 6 6 6-6'],
  ajustes: ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M9 4v4', 'M15 10v4', 'M9 16v4'],
  tablero: ['M3 3h7v7H3Z', 'M14 3h7v7h-7Z', 'M3 14h7v7H3Z', 'M14 14h7v7h-7Z'],
  documento: ['M6 3h8l4 4v14H6Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  historial: ['M3 12a9 9 0 1 1 2.5 6.2', 'M3 16v-4h4', 'M12 7v5l3 2'],
  salir: ['M11 4H4v16h7', 'M9 12h11', 'm16 8 4 4-4 4'],
  cerrar: ['m6 6 12 12', 'M18 6 6 18'],
  camara: ['M4 7h4l2-3h4l2 3h4v13H4Z', 'M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
  reloj: ['M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'M9 6l1-4h4l1 4M9 18l1 4h4l1-4M12 9v3l2 1'],
};
</script>

<template>
  <svg :width="tamano" :height="tamano" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="trazo in trazos[nombre]" :key="trazo" :d="trazo" />
  </svg>
</template>
