// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateLogin, validateRefresh } from '../middlewares/validators';

const router = Router();
const authController = new AuthController();

/**
 * @openapi
 * tags:
 *   - name: auth
 *     description: Autenticación y token
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión y obtener JWT
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Autenticación exitosa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '401':
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validateLogin, authController.login.bind(authController));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión (no invalida JWT)
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - auth
 *     responses:
 *       '200':
 *         description: Logout exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 */
router.post('/logout', authController.logout.bind(authController));

/**
 * @openapi
 * /auth/verify:
 *   get:
 *     summary: Verificar validez de token y obtener datos de usuario
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - auth
 *     responses:
 *       '200':
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyResponse'
 *       '401':
 *         description: Token inválido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/verify', authController.verify.bind(authController));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Renovar token JWT
 *     tags:
 *       - auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *     responses:
 *       '200':
 *         description: Token renovado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshResponse'
 *       '401':
 *         description: Token inválido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', validateRefresh, authController.refresh.bind(authController));

export default router;
