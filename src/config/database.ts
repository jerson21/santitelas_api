// src/config/database.ts - VERSIÓN CORREGIDA
import { Sequelize } from 'sequelize-typescript';
import path from 'path';
import * as dotenv from 'dotenv';

// ✅ CORREGIDO: Solo una vez
dotenv.config();

// ✅ CORREGIDO: Configuración de Sequelize con modelos
export const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'santitelas',
  username: process.env.DB_USER || 'santitelas_user',
  password: process.env.DB_PASS || 'santitelas_pass_2024',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mysql',
  
  dialectOptions: {
    connectTimeout: 60000, // 60 segundos
    charset: 'utf8mb4'
  },
  
  // ✅ CORREGIDO: Los modelos se registran manualmente en models/index.ts
  // No especificar models aquí para evitar conflicto con sequelize.addModels()
  
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '-03:00', // Chile timezone
  
  define: {
    timestamps: false, // Usamos nuestros propios campos de fecha
    underscored: false, // Mantener nombres tal cual en BD
    freezeTableName: true, // No pluralizar nombres de tablas
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    hooks: true // ✅ AGREGADO: Habilitar hooks globalmente
  },
  
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Función para probar la conexión (sin cambios)
export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente.');
    return true;
  } catch (error) {
    console.error('❌ No se pudo conectar a la base de datos:', error);
    return false;
  }
}

// ✅ AGREGADO: Función para inicializar la base de datos
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔌 Conectando a MySQL...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');
    
    console.log('🔄 Sincronizando modelos...');
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      force: false // ✅ IMPORTANTE: Nunca usar force para no eliminar datos
    });
    console.log('✅ Modelos sincronizados');
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}