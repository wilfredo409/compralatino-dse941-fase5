import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Servidor de desarrollo en :5173, proxy hacia el backend (:3000) para
// evitar problemas de CORS/URL absoluta durante el desarrollo local.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
