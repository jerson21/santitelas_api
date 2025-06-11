// src/routes/admin.routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { validateCreateUsuario } from '../middlewares/validators';
import { UserController } from '../controllers/UserController';
import { Usuario } from '../models/Usuario.model';
import { Rol } from '../models/Rol.model';

const router = Router();
const userController = new UserController();

// Todas estas rutas requieren token válido
router.use(auth);

/**
 * @openapi
 * /admin/roles:
 *   get:
 *     summary: Obtener lista de roles disponibles
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_rol:
 *                         type: integer
 *                       nombre:
 *                         type: string
 *                       descripcion:
 *                         type: string
 */
router.get('/roles', async (req, res, next) => {
  try {
    const roles = await Rol.findAll({
      where: { activo: true },
      attributes: ['id_rol', 'nombre', 'descripcion'],
      order: [['id_rol', 'ASC']]
    });

    res.json({ 
      success: true, 
      data: roles 
    });
  } catch (error) {
    next(error);
  }
});

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
    const users = await Usuario.findAll({
      include: [
        {
          model: Rol,
          as: 'rol',
          attributes: ['nombre']
        }
      ],
      attributes: {
        exclude: ['password_hash']
      }
    });

    // Mapear los datos para incluir el rol como string
    const usersWithRole = users.map(user => {
      const userData = user.toJSON();
      return {
        ...userData,
        rol: userData.rol?.nombre || 'usuario',
        rol_data: undefined
      };
    });

    res.json({ success: true, data: usersWithRole });
  } catch (error) {
    next(error);
  }
});

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
 */
router.post(
  '/usuarios',
  validateCreateUsuario,
  userController.create.bind(userController)
);

/**
 * @openapi
 * /admin/usuarios/{id}:
 *   put:
 *     summary: Actualizar usuario existente
 *     tags:
 *       - admin
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.put('/usuarios/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre_completo, email, telefono, id_rol, activo, password } = req.body;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Actualizar campos
    const updateData: any = {
      nombre_completo,
      email,
      telefono,
      id_rol,
      activo
    };

    // Solo actualizar password si se envía
    if (password) {
      updateData.password_hash = password; // El hook del modelo lo hasheará
    }

    await usuario.update(updateData);

    // Recargar con rol incluido
    const updatedUser = await Usuario.findByPk(id, {
      include: [{
        model: Rol,
        as: 'rol',
        attributes: ['nombre']
      }],
      attributes: { exclude: ['password_hash'] }
    });

    const userData = updatedUser!.toJSON();
    userData.rol = userData.rol?.nombre || 'usuario';

    res.json({ 
      success: true, 
      data: userData,
      message: 'Usuario actualizado exitosamente' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/usuarios/{id}/activar:
 *   patch:
 *     summary: Activar/Desactivar usuario
 *     tags:
 *       - admin
 */
router.patch('/usuarios/:id/activar', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    await usuario.update({ activo });

    res.json({ 
      success: true, 
      data: { id_usuario: usuario.id_usuario, activo: usuario.activo },
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente` 
    });
  } catch (error) {
    next(error);
  }
});

export default router;