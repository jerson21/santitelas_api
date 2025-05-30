// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'sequelize';

// Interfaz para errores personalizados
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  errors?: any[];
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log del error para debugging
  console.error('🔴 Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Valores por defecto
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let errors: any[] = [];

  // Manejo de errores de Sequelize
  if (err instanceof ValidationError) {
    statusCode = 400;
    message = 'Error de validación';
    errors = err.errors.map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
  }

  // Errores de base de datos
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'El registro ya existe';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referencia a registro inexistente';
  }

  // Errores de autenticación
  if (err.name === 'UnauthorizedError' || err.code === 'UNAUTHORIZED') {
    statusCode = 401;
    message = 'No autorizado';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
  }

  // Respuesta de error
  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.message
    })
  });
};