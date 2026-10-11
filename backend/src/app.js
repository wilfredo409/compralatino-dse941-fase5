import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

import { authRouter } from './routes/auth.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';
import { productosRouter } from './routes/productos.routes.js';
import { categoriasRouter } from './routes/categorias.routes.js';
import { pedidosRouter } from './routes/pedidos.routes.js';
import { recomendacionesRouter } from './routes/recomendaciones.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();
const openApiDocument = parse(readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8'));

app.use(cors());
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/api/v1/salud', (req, res) => res.json({ ok: true, servicio: 'compralatino-api', version: '1.0.0' }));

// Rutas por módulo, tal como las agrupa openapi.yaml (M1..M5)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/usuarios', usuariosRouter);
app.use('/api/v1/productos', productosRouter);
app.use('/api/v1/categorias', categoriasRouter);
app.use('/api/v1/pedidos', pedidosRouter);
app.use('/api/v1/recomendaciones', recomendacionesRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/webhooks', webhooksRouter);

app.use((req, res) => res.status(404).json({ codigo: 'ERROR_NO_ENCONTRADO', mensaje: 'Ruta no encontrada' }));
app.use(errorHandler);
