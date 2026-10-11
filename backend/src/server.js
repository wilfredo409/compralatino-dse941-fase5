import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`CompraLatino API escuchando en http://localhost:${PORT}/api/v1`);
  console.log(`Documentación Swagger disponible en http://localhost:${PORT}/api/docs`);
});
