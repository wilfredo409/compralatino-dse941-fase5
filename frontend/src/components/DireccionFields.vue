<script setup>
defineProps({ prefix: { type: String, required: true } });
const direccion = defineModel({ type: Object, required: true });
</script>

<template>
  <div class="form-columnas">
    <label :for="`${prefix}-pais`">País
      <input :id="`${prefix}-pais`" v-model.trim="direccion.pais" maxlength="60" required autocomplete="country-name" />
    </label>
    <label :for="`${prefix}-departamento`">Departamento o provincia
      <input :id="`${prefix}-departamento`" v-model.trim="direccion.departamento" maxlength="60" required autocomplete="address-level1" />
    </label>
    <label :for="`${prefix}-ciudad`">Ciudad
      <input :id="`${prefix}-ciudad`" v-model.trim="direccion.ciudad" maxlength="80" required autocomplete="address-level2" />
    </label>
    <label :for="`${prefix}-detalle`">Dirección
      <input :id="`${prefix}-detalle`" v-model.trim="direccion.detalle" maxlength="250" required autocomplete="street-address" />
    </label>
  </div>
</template>
