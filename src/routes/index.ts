// src/routes/index.ts
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerComponents } from '../swaggerDef';
import path from 'path';

import authRoutes from './auth.routes';
import vendedorRoutes from './vendedor.routes';
import cajeroRoutes from './cajero.routes';
import adminRoutes from './admin.routes';
import debugRoutes from './debug.routes';
import productosRoutes from './productos.routes'; 
import categoriasRoutes from './categorias.routes';
import bodegasRoutes from './bodegas.routes';
import stockRoutes from './stock.routes';
import productosAdminRoutes from './productos-admin.routes';
import dteRoutes from './dte.routes';

import { authenticateToken } from '../middlewares/auth';

const router = Router();

// 1. Opciones de swagger-jsdoc
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SANTITELAS API',
      version: '2.0.0',
      description: 'API RESTful para el sistema POS SANTITELAS'
    },
    servers: [
      { url: 'http://localhost:5000/api' }
    ],
    components: swaggerComponents,
    security: [
      { bearerAuth: [] }
    ]
  },
  // 2. Dónde buscar las anotaciones JSDoc en archivos de rutas
   apis: [
    // Para que en desarrollo (ts-node) lea los .ts
    path.join(__dirname, '/**/*.routes.ts'),
    // Para que en producción (tras tsc) lea los .js
    path.join(__dirname, '/**/*.routes.js'),
  ],
  
};

// 3. Generar spec
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// 4. Montar Swagger UI en /docs
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { docExpansion: 'none' }
  })
);

// Rutas públicas
router.use('/auth', authRoutes);
router.use('/debug', debugRoutes);

// Rutas protegidas
router.use('/vendedor', authenticateToken, vendedorRoutes);
router.use('/cajero', authenticateToken, cajeroRoutes);
router.use('/admin', authenticateToken, adminRoutes);

// Rutas de productos y categorías (separadas)
// Rutas de consulta (para vendedores/clientes)
router.use('/productos', authenticateToken, productosRoutes);  
router.use('/categorias', authenticateToken, categoriasRoutes);

// Rutas de inventario y stock
router.use('/bodegas', authenticateToken, bodegasRoutes);
router.use('/stock', authenticateToken, stockRoutes);


// Rutas de administración (para administradores)
router.use('/productos-admin', authenticateToken,productosAdminRoutes);

// Rutas de facturación electrónica (Relbase)
router.use('/dte', authenticateToken, dteRoutes);






// Ruta de prueba
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    debug_available: process.env.NODE_ENV !== 'production'
  });
});

export default router;
