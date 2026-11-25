<script setup>
import creditos from '../creditos-catalogo.json';
</script>

<template>
  <header class="encabezado-pagina"><div><h1>Créditos de imágenes</h1><p>Fotografías de referencia del catálogo de demostración.</p></div></header>
  <section class="superficie">
    <h2>Fotografías reutilizadas</h2>
    <p>Las imágenes de Wikimedia Commons se redimensionaron y se convirtieron a WebP. Cada una conserva la licencia indicada en su fuente.</p>
    <ul class="creditos-imagenes">
      <li v-for="foto in creditos" :key="foto.imagen">
        <strong>{{ foto.producto }}</strong>
        <p>{{ foto.autor }} · <a :href="foto.licenciaUrl">{{ foto.licencia }}</a></p>
        <a :href="foto.pagina">{{ foto.titulo }}</a>
      </li>
    </ul>
  </section>
  <section class="superficie creditos-generados">
    <h2>Imágenes generadas</h2>
    <p>La portada y las demás imágenes del catálogo se generaron para CompraLatino. Ilustran la clase de artículo y su apariencia general.</p>
  </section>
</template>
