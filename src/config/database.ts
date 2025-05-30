// src/config/database.ts
import { Sequelize } from 'sequelize-typescript';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

// Cargar variables de entorno
dotenv.config();

// Configuración de Sequelize
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
  // Los modelos se registran programáticamente en initializeModels()
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '-03:00', // Chile timezone
  define: {
    timestamps: false, // Usamos nuestros propios campos de fecha
    underscored: false, // Mantener nombres tal cual en BD
    freezeTableName: true, // No pluralizar nombres de tablas
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Función para probar la conexión
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