// src/controllers/AuthController.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { Usuario } from '../models/Usuario.model';
import { Rol } from '../models/Rol.model';

dotenv.config();

export class AuthController {
  // POST /api/auth/login
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      // Buscar usuario con su rol (usando el campo correcto 'usuario')
      const usuario = await Usuario.findOne({
        where: { usuario: username, activo: true },
        include: [{ 
          model: Rol, 
          as: 'rol', 
          attributes: ['id_rol', 'nombre', 'permisos'] 
        }]
      });

      if (!usuario) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario o contraseña incorrectos' 
        });
      }

      // Verificar contraseña
      const passwordValido = await usuario.verificarPassword(password);
      if (!passwordValido) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario o contraseña incorrectos' 
        });
      }

      // Generar token JWT
      const secret = process.env.JWT_SECRET || 'santitelas_secret';
      const rawExpires = process.env.JWT_EXPIRES_IN || '24h';
      const options: SignOptions = { expiresIn: rawExpires as any };

      const token = jwt.sign(
        {
          id: usuario.id_usuario,
          username: usuario.usuario,
          rol: usuario.rol.nombre,
          permisos: usuario.rol.permisos
        },
        secret,
        options
      );

      // Actualizar último acceso
      await usuario.update({ ultimo_acceso: new Date() });

      // Responder con token y datos del usuario
      res.json({
        success: true,
        data: {
          token,
          usuario: {
            id: usuario.id_usuario,
            username: usuario.usuario,
            nombre_completo: usuario.nombre_completo,
            email: usuario.email,
            rol: usuario.rol.nombre,
            permisos: usuario.rol.permisos
          }
        },
        message: 'Login exitoso'
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, message: 'Logout exitoso' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/verify
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token no proporcionado' 
        });
      }

      // Verificar token
      const secret = process.env.JWT_SECRET || 'santitelas_secret';
      const decoded = jwt.verify(token, secret) as any;

      // Buscar usuario actualizado
      const usuario = await Usuario.findByPk(decoded.id, {
        include: [{ 
          model: Rol, 
          as: 'rol', 
          attributes: ['nombre', 'permisos'] 
        }],
        attributes: ['id_usuario', 'usuario', 'nombre_completo', 'email', 'activo']
      });

      if (!usuario || !usuario.activo) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no válido' 
        });
      }

      res.json({
        success: true,
        data: {
          usuario: {
            id: usuario.id_usuario,
            username: usuario.usuario,
            nombre_completo: usuario.nombre_completo,
            email: usuario.email,
            rol: usuario.rol.nombre,
            permisos: usuario.rol.permisos
          },
          token_exp: decoded.exp
        }
      });

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido' 
        });
      }
      next(error);
    }
  }

  // POST /api/auth/refresh
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token no proporcionado' 
        });
      }

      // Verificar token actual
      const secret = process.env.JWT_SECRET || 'santitelas_secret';
      const decoded = jwt.verify(token, secret) as any;

      // Generar nuevo token
      const rawExpires = process.env.JWT_EXPIRES_IN || '24h';
      const options: SignOptions = { expiresIn: rawExpires as any };

      const newToken = jwt.sign(
        {
          id: decoded.id,
          username: decoded.username,
          rol: decoded.rol,
          permisos: decoded.permisos
        },
        secret,
        options
      );

      res.json({ 
        success: true, 
        data: { token: newToken }, 
        message: 'Token renovado exitosamente' 
      });

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido o expirado' 
        });
      }
      next(error);
    }
  }
}