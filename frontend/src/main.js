import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { restaurarSesion } from './store/auth.js';
import './styles.css';

restaurarSesion().finally(() => {
  createApp(App).use(router).mount('#app');
});
