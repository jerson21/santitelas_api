// src/routes/admin.routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { validateCreateUsuario } from '../middlewares/validators';
import { UserController } from '../controllers/UserController';
import { Usuario } from '../models/Usuario.model';
import { Rol } from '../models/Rol.model';
import { Cliente } from '../models/Cliente.model';
import { Pedido } from '../models/Pedido.model';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

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

// =====================================================
// GESTIÓN DE CLIENTES
// =====================================================

/**
 * @openapi
 * /admin/clientes:
 *   get:
 *     summary: Listar todos los clientes con estadísticas
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 */
router.get('/clientes', async (req, res, next) => {
  try {
    console.log('📋 [ADMIN] Obteniendo lista de clientes...');

    // Obtener clientes con conteo de pedidos
    const clientes = await sequelize.query(`
      SELECT
        c.*,
        COUNT(DISTINCT p.id_pedido) as total_compras,
        COALESCE(SUM(CASE WHEN p.estado = 'completado' THEN p.total ELSE 0 END), 0) as monto_total_compras,
        COALESCE(SUM(CASE WHEN p.estado = 'vale_pendiente' THEN p.total ELSE 0 END), 0) as monto_pendiente
      FROM clientes c
      LEFT JOIN pedidos p ON p.id_cliente = c.id_cliente
      GROUP BY c.id_cliente
      ORDER BY c.fecha_creacion DESC
    `, {
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: clientes,
      message: `Se encontraron ${clientes.length} clientes`
    });
  } catch (error) {
    console.error('❌ Error obteniendo clientes:', error);
    next(error);
  }
});

/**
 * @openapi
 * /admin/clientes/{id}:
 *   get:
 *     summary: Obtener detalle de un cliente
 *     tags:
 *       - admin
 */
router.get('/clientes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cliente = await Cliente.findByPk(id);

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Obtener estadísticas
    const stats = await sequelize.query(`
      SELECT
        COUNT(*) as total_pedidos,
        SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as pedidos_completados,
        SUM(CASE WHEN estado = 'vale_pendiente' THEN 1 ELSE 0 END) as pedidos_pendientes,
        COALESCE(SUM(CASE WHEN estado = 'completado' THEN total ELSE 0 END), 0) as monto_pagado,
        COALESCE(SUM(CASE WHEN estado = 'vale_pendiente' THEN total ELSE 0 END), 0) as monto_pendiente
      FROM pedidos
      WHERE id_cliente = :idCliente
    `, {
      replacements: { idCliente: id },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: {
        ...cliente.toJSON(),
        estadisticas: stats[0] || {}
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/clientes:
 *   post:
 *     summary: Crear nuevo cliente
 *     tags:
 *       - admin
 */
router.post('/clientes', async (req, res, next) => {
  try {
    const {
      rut,
      tipo_cliente,
      nombre,
      telefono,
      email,
      razon_social,
      direccion,
      comuna,
      giro,
      datos_completos
    } = req.body;

    // Validar RUT obligatorio
    if (!rut) {
      return res.status(400).json({
        success: false,
        message: 'RUT es obligatorio'
      });
    }

    // Verificar si ya existe
    const existente = await Cliente.findOne({ where: { rut } });
    if (existente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con este RUT'
      });
    }

    // Crear cliente
    const nuevoCliente = await Cliente.create({
      rut,
      tipo_cliente: tipo_cliente || 'persona',
      nombre,
      telefono,
      email,
      razon_social,
      direccion,
      comuna,
      giro,
      datos_completos: datos_completos || false,
      activo: true
    });

    res.status(201).json({
      success: true,
      data: nuevoCliente,
      message: 'Cliente creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando cliente:', error);
    next(error);
  }
});

/**
 * @openapi
 * /admin/clientes/{id}:
 *   put:
 *     summary: Actualizar cliente existente
 *     tags:
 *       - admin
 */
router.put('/clientes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      tipo_cliente,
      nombre,
      telefono,
      email,
      razon_social,
      direccion,
      comuna,
      giro,
      datos_completos
    } = req.body;

    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    await cliente.update({
      tipo_cliente,
      nombre,
      telefono,
      email,
      razon_social,
      direccion,
      comuna,
      giro,
      datos_completos,
      fecha_actualizacion: new Date()
    });

    res.json({
      success: true,
      data: cliente,
      message: 'Cliente actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando cliente:', error);
    next(error);
  }
});

/**
 * @openapi
 * /admin/clientes/{id}/activar:
 *   patch:
 *     summary: Activar/Desactivar cliente
 *     tags:
 *       - admin
 */
router.patch('/clientes/:id/activar', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const cliente = await Cliente.findByPk(id);
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    await cliente.update({
      activo,
      fecha_actualizacion: new Date()
    });

    res.json({
      success: true,
      data: { id_cliente: cliente.id_cliente, activo: cliente.activo },
      message: `Cliente ${activo ? 'activado' : 'desactivado'} exitosamente`
    });
  } catch (error) {
    next(error);
  }
});

export default router;