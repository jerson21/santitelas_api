// src/server.ts - VERSIÓN COMPLETA CON VALIDACIÓN DE TRANSFERENCIAS
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
import { authenticateToken } from './middlewares/auth';

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

// ========== NUEVO: ALMACENAR TRANSFERENCIAS PENDIENTES ==========
const transferenciasPendientes = new Map<string, any>();

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

// ========== SOCKET.IO EVENTOS ACTUALIZADOS ==========
io.on('connection', (socket) => {
  console.log(`👤 Cliente conectado: ${socket.id}`);
  
  socket.on('join_admin', (data) => {
  // Aceptar tanto 'admin' como 'administrador'
  if (data.rol === 'admin' || data.rol === 'administrador') {
    socket.join('admin');
    console.log(`👔 Admin ${data.usuario} conectado`);
  }
});



  
  // ========== NUEVOS EVENTOS PARA TRANSFERENCIAS ==========
  
  // Evento cuando un cajero solicita validación
  socket.on('solicitar_validacion_transferencia', (data) => {
    console.log(`💳 Solicitud de validación de transferencia:`, data);
    
    const solicitud = {
      id: `TRANS-${Date.now()}`,
      socket_cajero: socket.id,
      timestamp: new Date(),
      ...data,
      estado: 'pendiente'
    };
    
    // Guardar en memoria
    transferenciasPendientes.set(solicitud.id, solicitud);
    
    // Notificar a TODOS los administradores conectados
    io.to('admin').emit('nueva_transferencia_pendiente', {
      id: solicitud.id,
      cajero: data.cajero_nombre,
      cliente: data.cliente_nombre,
      monto: data.monto,
      banco: data.banco,
      cuenta_destino : data.cuenta_destino,
      tempId : data.tempId,
      referencia: data.referencia,
      numero_vale: data.numero_vale,
      timestamp: solicitud.timestamp
    });
    
    // Confirmar al cajero que se envió la solicitud
    socket.emit('validacion_iniciada', {
      id: solicitud.id,
      mensaje: 'Esperando validación del administrador...'
    });
    
    // Timeout de 5 minutos
    setTimeout(() => {
      const solicitudActual = transferenciasPendientes.get(solicitud.id);
      if (solicitudActual && solicitudActual.estado === 'pendiente') {
        // Si después de 5 minutos no hay respuesta
        transferenciasPendientes.delete(solicitud.id);
        
        io.to(solicitudActual.socket_cajero).emit('validacion_timeout', {
          id: solicitud.id,
          mensaje: 'Tiempo de espera agotado. Procesar como validación posterior.'
        });
      }
    }, 5 * 60 * 1000); // 5 minutos
  });
  
  // Evento cuando el admin responde a la validación
  socket.on('responder_validacion_transferencia', (data) => {
    console.log(`✅ Respuesta de admin para transferencia:`, data);
    
    const solicitud = transferenciasPendientes.get(data.id);
    
    if (!solicitud) {
      socket.emit('error_validacion', {
        mensaje: 'Solicitud no encontrada o ya procesada'
      });
      return;
    }
    
    // Actualizar estado
    solicitud.estado = data.validada ? 'aprobada' : 'rechazada';
    solicitud.admin_usuario = data.admin_usuario;
    solicitud.observaciones_admin = data.observaciones;
    solicitud.timestamp_respuesta = new Date();
    
    // Enviar respuesta al cajero específico
    io.to(solicitud.socket_cajero).emit('resultado_validacion', {
      id: solicitud.id,
      validada: data.validada,
      mensaje: data.validada 
        ? '✅ Transferencia validada correctamente'
        : '❌ Transferencia no encontrada o rechazada',
      observaciones: data.observaciones,
      admin: data.admin_usuario
    });
    
    // Notificar a otros admins que ya se procesó
    socket.to('admin').emit('transferencia_procesada', {
      id: solicitud.id,
      procesada_por: data.admin_usuario
    });
    
    // Limpiar de memoria después de un minuto
    setTimeout(() => {
      transferenciasPendientes.delete(data.id);
    }, 60000);
  });
  
  // Evento para obtener transferencias pendientes (cuando un admin se conecta)
  socket.on('obtener_transferencias_pendientes', () => {
    if (socket.rooms.has('admin')) {
      const pendientes = Array.from(transferenciasPendientes.values())
        .filter(t => t.estado === 'pendiente')
        .map(t => ({
          id: t.id,
          cajero: t.cajero_nombre,
          cliente: t.cliente_nombre,
          monto: t.monto,
          banco: t.banco,
          referencia: t.referencia,
          numero_vale: t.numero_vale,
          timestamp: t.timestamp,
          tiempo_esperando: Math.floor((Date.now() - new Date(t.timestamp).getTime()) / 1000)
        }));
      
      socket.emit('lista_transferencias_pendientes', pendientes);
    }
  });
  
  // Evento para cancelar validación (por el cajero)
  socket.on('cancelar_validacion_transferencia', (data) => {
    const solicitud = transferenciasPendientes.get(data.id);
    
    if (solicitud && solicitud.socket_cajero === socket.id) {
      transferenciasPendientes.delete(data.id);
      
      // Notificar a admins que se canceló
      io.to('admin').emit('transferencia_cancelada', {
        id: data.id,
        motivo: data.motivo || 'Cancelada por el cajero'
      });
      
      socket.emit('validacion_cancelada', {
        id: data.id,
        mensaje: 'Validación cancelada exitosamente'
      });
    }
  });
  
  // Limpiar transferencias cuando se desconecta
  socket.on('disconnect', () => {
    console.log(`👤 Cliente desconectado: ${socket.id}`);
    
    // Si era un cajero con transferencias pendientes
    transferenciasPendientes.forEach((solicitud, id) => {
      if (solicitud.socket_cajero === socket.id && solicitud.estado === 'pendiente') {
        // Notificar a admins que el cajero se desconectó
        io.to('admin').emit('cajero_desconectado', {
          id: id,
          cajero: solicitud.cajero_nombre,
          mensaje: 'El cajero se desconectó con una transferencia pendiente'
        });
      }
    });
  });
});

// Rutas API
app.use('/api', routes);

// ========== NUEVO ENDPOINT: Estadísticas de transferencias ==========
app.get('/api/transferencias/pendientes', authenticateToken, (req, res) => {
  const pendientes = Array.from(transferenciasPendientes.values())
    .filter(t => t.estado === 'pendiente');
  
  res.json({
    success: true,
    data: {
      total: pendientes.length,
      transferencias: pendientes.map(t => ({
        id: t.id,
        cajero: t.cajero_nombre,
        monto: t.monto,
        banco: t.banco,
        tiempo_esperando: Math.floor((Date.now() - new Date(t.timestamp).getTime()) / 1000)
      }))
    }
  });
});

// ========== NUEVO ENDPOINT: Estado del sistema Socket.IO ==========
app.get('/api/socket/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      conectados: io.sockets.sockets.size,
      admins_online: io.sockets.adapter.rooms.get('admin')?.size || 0,
      cajeros_online: io.sockets.adapter.rooms.get('cajeros')?.size || 0,
      vendedores_online: io.sockets.adapter.rooms.get('vendedores')?.size || 0,
      transferencias_pendientes: transferenciasPendientes.size,
      transferencias_detalle: Array.from(transferenciasPendientes.values()).map(t => ({
        id: t.id,
        estado: t.estado,
        cajero: t.cajero_nombre,
        tiempo: Math.floor((Date.now() - new Date(t.timestamp).getTime()) / 1000)
      }))
    }
  });
});

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
      environment: process.env.NODE_ENV || 'development',
      websocket: {
        conectados: io.sockets.sockets.size,
        transferencias_pendientes: transferenciasPendientes.size
      }
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
      '✅ Estructura jerárquica de productos',
      '✅ Validación de transferencias en tiempo real'
    ],
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      vendedor: '/api/vendedor/*',
      cajero: '/api/cajero/*',
      admin: '/api/admin/*',
      transferencias: '/api/transferencias/pendientes',
      socketStatus: '/api/socket/status'
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

// Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');
    
    console.log('📊 Inicializando modelos...');
    await initializeModels();
    console.log('✅ Modelos Sequelize inicializados');
    
    console.log('🔗 Configurando asociaciones...');
    setupAssociations();
    console.log('✅ Asociaciones configuradas');
    
    console.log('🔄 Verificando esquema de base de datos...');
    await sequelize.sync({ alter: false });
    console.log('✅ Base de datos sincronizada');

    if (process.env.SEED_DATABASE === 'true') {
      console.log('🌱 Ejecutando seeder...');
      await seedDatabase();
      console.log('✅ Seeder completado');
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
      console.log(`   • Transferencias: http://localhost:${PORT}/api/transferencias/pendientes`);
      console.log(`   • Socket Status: http://localhost:${PORT}/api/socket/status`);
      console.log('==========================================');
      console.log('🎯 WebSocket eventos disponibles:');
      console.log('   • solicitar_validacion_transferencia');
      console.log('   • responder_validacion_transferencia');
      console.log('   • obtener_transferencias_pendientes');
      console.log('   • cancelar_validacion_transferencia');
      console.log('==========================================');
      console.log('🧪 Pruebas rápidas:');
      console.log(`   curl http://localhost:${PORT}/api/health`);
      console.log(`   curl -X POST http://localhost:${PORT}/api/auth/login -H "Content-Type: application/json" -d '{"username":"vendedor1","password":"vendedor123"}'`);
      console.log('==========================================');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Modo desarrollo activo');
        console.log('📝 Logs SQL: Activados');
        console.log('🌱 Para sembrar datos: SEED_DATABASE=true');
        console.log('🔧 Transferencias en memoria (no persistentes)');
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
  
  // Notificar a todos los clientes antes de cerrar
  io.emit('server_closing', { message: 'El servidor se está cerrando' });
  
  // Dar tiempo para que se envíen los mensajes
  setTimeout(async () => {
    io.close();
    await sequelize.close();
    process.exit(0);
  }, 1000);
});

process.on('SIGINT', async () => {
  console.log('📛 SIGINT recibido, cerrando servidor...');
  
  // Mostrar estadísticas finales
  console.log(`📊 Estadísticas finales:`);
  console.log(`   • Clientes conectados: ${io.sockets.sockets.size}`);
  console.log(`   • Transferencias pendientes: ${transferenciasPendientes.size}`);
  
  io.emit('server_closing', { message: 'El servidor se está cerrando' });
  
  setTimeout(async () => {
    io.close();
    await sequelize.close();
    process.exit(0);
  }, 1000);
});

// Iniciar servidor
startServer();