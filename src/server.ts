// src/server.ts - VERSIÓN CORREGIDA
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { sequelize } from './config/database';
import { initializeModels, setupAssociations } from './models'; // ✅ IMPORTAR setupAssociations
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { seedDatabase } from './utils/seeder';

// Cargar variables de entorno
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL?.split(',') || ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middlewares globales
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(',') || ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO disponible globalmente
app.set('io', io);

// Socket.IO eventos
io.on('connection', (socket) => {
  console.log(`👤 Cliente conectado: ${socket.id}`);
  
  socket.on('join_vendedor', (data) => {
    socket.join('vendedores');
    console.log(`🛍️ Vendedor ${data.usuario} conectado`);
  });
  
  socket.on('join_cajero', (data) => {
    socket.join('cajeros');
    console.log(`💵 Cajero ${data.usuario} conectado`);
  });
  
  socket.on('join_admin', (data) => {
    socket.join('admin');
    console.log(`👔 Admin ${data.usuario} conectado`);
  });
  
  socket.on('disconnect', () => {
    console.log(`👤 Cliente desconectado: ${socket.id}`);
  });
});

// Rutas API
app.use('/api', routes);

// Health check con verificación de BD
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT 1+1 as result');
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'SANTITELAS API',
      version: '2.0.0',
      database: 'Connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'SANTITELAS API',
      version: '2.0.0',
      database: 'Disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: '🏪 SANTITELAS API v2.0',
    description: 'Sistema POS moderno para control de telas e inventario',
    status: 'Funcionando correctamente',
    features: [
      '✅ ORM con Sequelize',
      '✅ Modelos con validaciones',
      '✅ WebSockets con Socket.IO',
      '✅ Autenticación JWT',
      '✅ API RESTful',
      '✅ Estructura jerárquica de productos'
    ],
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      vendedor: '/api/vendedor/*',
      cajero: '/api/cajero/*',
      admin: '/api/admin/*'
    }
  });
});

// Manejo de errores
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    path: req.originalUrl,
    method: req.method
  });
});

// ✅ FUNCIÓN CORREGIDA PARA INICIALIZAR LA BASE DE DATOS
async function initializeDatabase() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');
    
    console.log('📊 Inicializando modelos...');
    await initializeModels();
    console.log('✅ Modelos Sequelize inicializados');
    
    // ✅ CONFIGURAR ASOCIACIONES ANTES DE SYNC
    console.log('🔗 Configurando asociaciones...');
    setupAssociations();
    console.log('✅ Asociaciones configuradas');
    
    // Sincronizar esquema de base de datos
    console.log('🔄 Sincronizando esquema de base de datos...');
    if (process.env.SEED_DATABASE === 'true') {
      console.log('🗑️  SEED_DATABASE=true: eliminando y recreando tablas (force sync)...');
      await sequelize.sync({ force: true });
      console.log('✅ Tablas recreadas fresh (force sync)');
    } else {
      console.log('⚙️  Ajustando esquema con alter...');
      await sequelize.sync({ alter: true });
      console.log('✅ Base de datos sincronizada (esquema ajustado)');
    }

    // Sembrar datos iniciales si SEED_DATABASE=true
    if (process.env.SEED_DATABASE === 'true') {
      console.log('🌱 Sembrando datos iniciales...');
      await seedDatabase();
      console.log('✅ Datos iniciales sembrados');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

// Función principal de inicio
async function startServer() {
  try {
    console.log('🏪 ==========================================');
    console.log('🏪 INICIANDO SANTITELAS API v2.0...');
    console.log('🏪 ==========================================');
    
    // Inicializar base de datos
    await initializeDatabase();
    
    // Iniciar servidor
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log('🏪 ==========================================');
      console.log('🏪 SANTITELAS API INICIADO EXITOSAMENTE');
      console.log('🏪 ==========================================');
      console.log(`🚀 Servidor: http://localhost:${PORT}`);
      console.log(`📡 WebSocket: ws://localhost:${PORT}`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
      console.log('==========================================');
      console.log('📋 Endpoints disponibles:');
      console.log(`   • Vendedor: http://localhost:${PORT}/api/vendedor/productos`);
      console.log(`   • Cajero: http://localhost:${PORT}/api/cajero`);
      console.log(`   • Admin: http://localhost:${PORT}/api/admin`);
      console.log('==========================================');
      console.log('🧪 Pruebas rápidas:');
      console.log(`   curl ${PORT}/api/health`);
      console.log(`   curl -X POST ${PORT}/api/auth/login -H "Content-Type: application/json" -d '{"username":"vendedor1","password":"vendedor123"}'`);
      console.log('==========================================');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Modo desarrollo activo');
        console.log('📝 Logs SQL: Activados');
        console.log('🌱 Para sembrar datos: SEED_DATABASE=true');
      }
    });
    
  } catch (error) {
    console.error('❌ Error fatal al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejo de señales para cierre limpio
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM recibido, cerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📛 SIGINT recibido, cerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

// Iniciar servidor
startServer();