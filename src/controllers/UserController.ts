import { Request, Response, NextFunction } from 'express';
import { Usuario } from '../models/Usuario.model';

export class UserController {
  // POST /api/admin/usuarios
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      // Extraer password separado para que el hook lo encripte
      const { password, ...rest } = req.body;
      // Crear usuario (password se guarda en password_hash vía hook)
      const user = await Usuario.create({
        ...rest,
        password_hash: password
      });
      // Devolver usuario sin hash
      const data = user.toJSON();
      res.status(201).json({ success: true, data: data, message: 'Usuario creado exitosamente' });
    } catch (error) {
      next(error);
    }
  }
}