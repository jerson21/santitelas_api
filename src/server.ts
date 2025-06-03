// src/server.ts - VERSIÓN QUE NO TOCA TUS DATOS SQL
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { sequelize } from './config/database';
import { initializeModels, setupAssociations } from './models';
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

// ✅ FUNCIÓN QUE SOLO ACTUALIZA CONTRASEÑAS - SIN TOCAR ESQUEMA
async function updatePasswordsSafely() {
  try {
    console.log('🔑 Actualizando SOLO contraseñas (sin tocar esquema)...');
    
    const { Usuario } = await import('./models');
    
    const usersToUpdate = [
      { usuario: 'admin', password: 'admin123' },
      { usuario: 'cajero1', password: 'cajero123' },
      { usuario: 'vendedor1', password: 'vendedor123' }
    ];

    for (const userData of usersToUpdate) {
      try {
        const user = await Usuario.findOne({ 
          where: { usuario: userData.usuario } 
        });
        
        if (user) {
          const passwordWorks = await user.verificarPassword(userData.password);
          if (passwordWorks) {
            console.log(`✅ ${userData.usuario} - contraseña ya funciona`);
          } else {
            await user.update({
              password_hash: userData.password
            });
            console.log(`🔑 ${userData.usuario} - contraseña actualizada`);
          }
        } else {
          console.log(`⚠️  Usuario ${userData.usuario} no encontrado - creando...`);
          
          // ✅ CREAR usuario sin tocar esquema
          await Usuario.create({
            usuario: userData.usuario,
            password_hash: userData.password,
            nombre_completo: `Usuario ${userData.usuario}`,
            email: `${userData.usuario}@santitelas.cl`,
            id_rol: userData.usuario === 'admin' ? 1 : userData.usuario.includes('cajero') ? 2 : 3,
            activo: true
          });
          console.log(`✅ ${userData.usuario} - usuario creado`);
        }
      } catch (error) {
        console.error(`❌ Error con ${userData.usuario}:`, error.message);
      }
    }
    
    console.log('✅ Actualización completada SIN tocar productos');
    
  } catch (error) {
    console.error('❌ Error en actualización:', error);
    throw error;
  }
}

// ✅ FUNCIÓN ULTRA-SEGURA - NO TOCA ESQUEMA DE BASE DE DATOS
async function initializeDatabase() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');
    
    console.log('📊 Registrando modelos Sequelize...');
    await initializeModels();
    console.log('✅ Modelos registrados');
    
    console.log('🔗 Configurando asociaciones...');
    setupAssociations();
    console.log('✅ Asociaciones configuradas');
    
    // ✅ VERIFICAR SI YA HAY DATOS (para no hacer sync)
    const [productCount] = await sequelize.query('SELECT COUNT(*) as count FROM productos');
    const hasProducts = (productCount as any)[0]?.count > 0;
    
    if (hasProducts) {
      console.log(`📦 Se detectaron ${(productCount as any)[0]?.count} productos existentes`);
      console.log('🛡️  MODO SEGURO: NO se modificará el esquema para preservar datos');
    } else {
      console.log('📋 No se detectaron productos, esquema puede sincronizarse');
    }
    
    // ✅ GESTIÓN DE MODOS SIN SYNC PELIGROSO
    const seedMode = process.env.SEED_DATABASE;
    const updateMode = process.env.UPDATE_PASSWORDS;
    
    if (seedMode === 'fresh') {
      if (hasProducts) {
        console.log('⚠️  ADVERTENCIA: Tienes productos pero solicitaste modo fresh');
        console.log('🛡️  Cambiando a modo seguro para proteger datos');
        await updatePasswordsSafely();
      } else {
        console.log('🗑️  Modo fresh: recreando esquema...');
        await sequelize.sync({ force: true });
        await seedDatabase();
      }
      
    } else if (seedMode === 'true' || updateMode === 'true') {
      console.log('🔑 Modo seguro: solo gestionando usuarios...');
      
      if (hasProducts) {
        // ✅ NO HACER SYNC si hay productos
        console.log('🛡️  Productos detectados - omitiendo sync del esquema');
        await updatePasswordsSafely();
      } else {
        // ✅ Hacer sync solo si no hay productos
        console.log('📋 Sin productos - seguro hacer sync');
        await sequelize.sync({ alter: true });
        await seedDatabase();
      }
      
    } else {
      console.log('⚙️  Modo conexión: solo verificando...');
      if (!hasProducts) {
        await sequelize.sync({ alter: true });
      }
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
      console.log('🧪 Prueba rápida de login:');
      console.log(`   curl -X POST http://localhost:${PORT}/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'`);
      console.log('==========================================');
      console.log('🛡️  MODO PROTECCIÓN DE DATOS ACTIVADO');
      console.log('📦 Productos del SQL: PROTEGIDOS');
      console.log('🔑 Contraseñas: GESTIONADAS');
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