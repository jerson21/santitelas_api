// src/controllers/DebugController.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuario.model';
import { Rol } from '../models/Rol.model';

export class DebugController {
  // POST /api/debug/login-test
  async loginTest(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      
      console.log('🔍 DEBUG - Iniciando prueba de login');
      console.log('📝 Datos recibidos:', { username, password });

      // Paso 1: Buscar usuario
      console.log('👤 Buscando usuario...');
      const usuario = await Usuario.findOne({
        where: { usuario: username, activo: true },
        include: [{ 
          model: Rol, 
          as: 'rol', 
          attributes: ['id_rol', 'nombre', 'permisos'] 
        }]
      });

      if (!usuario) {
        console.log('❌ Usuario no encontrado');
        return res.json({
          success: false,
          debug: {
            step: 'usuario_no_encontrado',
            username_searched: username,
            active_filter: true,
            message: 'Usuario no encontrado o no activo'
          }
        });
      }

      console.log('✅ Usuario encontrado:', {
        id: usuario.id_usuario,
        username: usuario.usuario,
        activo: usuario.activo,
        rol: usuario.rol?.nombre
      });

      // Paso 2: Verificar estructura del hash
      console.log('🔐 Verificando hash de contraseña...');
      console.log('Hash almacenado:', usuario.password_hash);
      console.log('Longitud del hash:', usuario.password_hash.length);
      console.log('Comienza con $2a$:', usuario.password_hash.startsWith('$2a$'));

      // Paso 3: Prueba directa con bcrypt
      console.log('🧪 Prueba directa con bcrypt...');
      const bcryptResult = await bcrypt.compare(password, usuario.password_hash);
      console.log('Resultado bcrypt directo:', bcryptResult);

      // Paso 4: Prueba con método del modelo
      console.log('🧪 Prueba con método del modelo...');
      const modelResult = await usuario.verificarPassword(password);
      console.log('Resultado método modelo:', modelResult);

      // Paso 5: Generar hash de prueba
      console.log('🔧 Generando hash de prueba...');
      const testHash = await bcrypt.hash(password, 10);
      console.log('Hash de prueba generado:', testHash);
      const testResult = await bcrypt.compare(password, testHash);
      console.log('Prueba con hash generado:', testResult);

      // Respuesta completa
      res.json({
        success: true,
        debug: {
          usuario_encontrado: true,
          usuario_data: {
            id: usuario.id_usuario,
            username: usuario.usuario,
            activo: usuario.activo,
            rol: usuario.rol?.nombre,
            email: usuario.email
          },
          hash_info: {
            stored_hash: usuario.password_hash,
            hash_length: usuario.password_hash.length,
            is_bcrypt_format: usuario.password_hash.startsWith('$2a$') || usuario.password_hash.startsWith('$2b$'),
            first_20_chars: usuario.password_hash.substring(0, 20)
          },
          password_tests: {
            bcrypt_direct: bcryptResult,
            model_method: modelResult,
            test_hash_works: testResult,
            all_match: bcryptResult === modelResult,
            recommendation: bcryptResult ? 'Hash funciona correctamente' : 'Hash no funciona - necesita actualización'
          },
          test_hash_generated: testHash
        }
      });

    } catch (error: any) { // ← TIPADO CORREGIDO
      console.error('❌ Error en debug:', error);
      res.status(500).json({
        success: false,
        debug: {
          error: error?.message || 'Error desconocido',
          stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        }
      });
    }
  }

  // POST /api/debug/fix-user
  async fixUser(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🔧 Arreglando usuario admin...');

      // Buscar usuario
      let usuario = await Usuario.findOne({
        where: { usuario: 'admin' }
      });

      if (!usuario) {
        console.log('👤 Usuario no existe, creando...');
        
        // Crear usuario nuevo
        usuario = await Usuario.create({
          usuario: 'admin',
          password_hash: 'admin123', // El hook lo hasheará
          nombre_completo: 'Administrador del Sistema',
          email: 'admin@santitelas.cl',
          id_rol: 1,
          activo: true
        });

        console.log('✅ Usuario creado');
      } else {
        console.log('🔄 Usuario existe, actualizando contraseña...');
        
        // Actualizar usando el hook
        await usuario.update({ password_hash: 'admin123' });
        
        console.log('✅ Contraseña actualizada usando hook');
      }

      // Recargar y verificar
      await usuario.reload();
      const passwordWorks = await usuario.verificarPassword('admin123');

      res.json({
        success: true,
        message: 'Usuario admin arreglado exitosamente',
        debug: {
          id: usuario.id_usuario,
          username: usuario.usuario,
          password_test: passwordWorks,
          hash_preview: usuario.password_hash.substring(0, 30) + '...',
          recommendation: passwordWorks ? 'Ya puedes hacer login con admin/admin123' : 'Aún hay problemas, usar SQL directo'
        }
      });

    } catch (error: any) { // ← TIPADO CORREGIDO
      console.error('❌ Error arreglando usuario:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  }

  // GET /api/debug/all-users
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarios = await Usuario.findAll({
        include: [{ 
          model: Rol, 
          as: 'rol', 
          attributes: ['nombre', 'permisos'] 
        }],
        attributes: [
          'id_usuario', 'usuario', 'nombre_completo', 
          'email', 'activo', 'fecha_creacion'
        ]
      });

      res.json({
        success: true,
        message: 'Lista de todos los usuarios',
        data: usuarios,
        count: usuarios.length
      });

    } catch (error: any) { // ← TIPADO CORREGIDO
      console.error('❌ Error obteniendo usuarios:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Error desconocido'
      });
    }
  }
}