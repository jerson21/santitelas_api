// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender la interfaz Request para incluir usuario
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        rol: string;
        permisos: string[];
      };
    }
  }
}

// Middleware para verificar token JWT
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación no proporcionado'
      });
    }

    // Verificar token
    jwt.verify(
      token,
      process.env.JWT_SECRET || 'santitelas_secret',
      (err, decoded) => {
        if (err) {
          return res.status(403).json({
            success: false,
            message: 'Token inválido o expirado'
          });
        }

        // Guardar información del usuario en el request
        req.user = decoded as any;
        next();
      }
    );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al verificar autenticación'
    });
  }
};

// Middleware para verificar roles específicos
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

// Middleware para verificar permisos específicos
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!req.user.permisos || !req.user.permisos.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `No tienes el permiso: ${permission}`
      });
    }

    next();
  };
};

// Middleware opcional de autenticación (no bloquea si no hay token)
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      jwt.verify(
        token,
        process.env.JWT_SECRET || 'santitelas_secret',
        (err, decoded) => {
          if (!err) {
            req.user = decoded as any;
          }
        }
      );
    }

    next();
  } catch (error) {
    next();
  }
};
// Alias para middleware de autenticación
export const auth = authenticateToken;