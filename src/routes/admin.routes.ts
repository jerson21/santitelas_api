// src/routes/admin.routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { validateCreateUsuario } from '../middlewares/validators';
import { UserController } from '../controllers/UserController';
import { Usuario } from '../models/Usuario.model';

const router = Router();
const userController = new UserController();

// Todas estas rutas requieren token válido
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: admin
 *     description: Administración de usuarios
 */

/**
 * @openapi
 * /admin/usuarios:
 *   post:
 *     summary: Crear nuevo usuario (rol ADMIN)
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUsuarioRequest'
 *     responses:
 *       '201':
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateUsuarioResponse'
 *       '400':
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/usuarios',
  validateCreateUsuario,
  userController.create.bind(userController)
);

/**
 * @openapi
 * /admin/usuarios:
 *   get:
 *     summary: Listar usuarios existentes (rol ADMIN)
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenericListResponse'
 *       '401':
 *         description: No autenticado o token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/usuarios', async (req, res, next) => {
  try {
    const users = await Usuario.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

export default router;