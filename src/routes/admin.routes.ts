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
 *     summary: Listar usuarios existentes (rol ADMIN) con paginación
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, email o teléfono
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *     responses:
 *       '200':
 *         description: Lista de usuarios paginada
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
    // Parámetros de paginación y búsqueda
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined;

    // Construir cláusula WHERE
    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { nombre_completo: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { telefono: { [Op.like]: `%${search}%` } }
      ];
    }

    if (activo !== undefined) {
      whereClause.activo = activo;
    }

    const { count, rows: users } = await Usuario.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Rol,
          as: 'rol',
          attributes: ['nombre']
        }
      ],
      attributes: {
        exclude: ['password_hash']
      },
      limit,
      offset,
      order: [['id_usuario', 'ASC']]
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

    res.json({
      success: true,
      data: usersWithRole,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
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
 *     summary: Listar todos los clientes con estadísticas y paginación
 *     tags:
 *       - admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Cantidad de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre, RUT, email, razón social o nombre fantasía
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 */
router.get('/clientes', async (req, res, next) => {
  try {
    console.log('📋 [ADMIN] Obteniendo lista de clientes...');

    // Parámetros de paginación y búsqueda
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined;

    // Construir cláusula WHERE para búsqueda
    let whereClause = '';
    const replacements: any = { limit, offset };

    if (search) {
      whereClause = `WHERE (c.nombre LIKE :searchStart OR c.rut LIKE :searchStart OR c.razon_social LIKE :searchStart OR c.nombre_fantasia LIKE :searchStart OR c.email LIKE :searchContains OR c.codigo_cliente LIKE :searchStart)`;
      replacements.searchStart = `${search}%`;
      replacements.searchContains = `%${search}%`;
    }

    if (activo !== undefined) {
      whereClause = whereClause
        ? `${whereClause} AND c.activo = :activo`
        : `WHERE c.activo = :activo`;
      replacements.activo = activo;
    }

    // Obtener total de registros
    const countResult = await sequelize.query(`
      SELECT COUNT(DISTINCT c.id_cliente) as total
      FROM clientes c
      ${whereClause}
    `, {
      replacements,
      type: QueryTypes.SELECT
    }) as any[];

    const total = countResult[0]?.total || 0;

    // Obtener clientes con conteo de pedidos (paginado)
    const clientes = await sequelize.query(`
      SELECT
        c.*,
        COUNT(DISTINCT p.id_pedido) as total_compras,
        COALESCE(SUM(CASE WHEN p.estado = 'completado' THEN p.total ELSE 0 END), 0) as monto_total_compras,
        COALESCE(SUM(CASE WHEN p.estado = 'vale_pendiente' THEN p.total ELSE 0 END), 0) as monto_pendiente
      FROM clientes c
      LEFT JOIN pedidos p ON p.id_cliente = c.id_cliente
      ${whereClause}
      GROUP BY c.id_cliente
      ORDER BY COALESCE(c.nombre_fantasia, c.razon_social, c.nombre) ASC
      LIMIT :limit OFFSET :offset
    `, {
      replacements,
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: clientes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      message: `Se encontraron ${total} clientes`
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
      nombre_fantasia,
      codigo_cliente,
      telefono,
      celular,
      email,
      razon_social,
      direccion,
      ciudad,
      comuna,
      giro,
      contacto_pago,
      email_pago,
      telefono_pago,
      contacto_comercial,
      email_comercial,
      descuento_default,
      linea_credito,
      dias_credito,
      forma_pago_default,
      lista_precios,
      restringir_si_vencido,
      dias_adicionales_morosidad,
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

    // Crear cliente con todos los campos
    const nuevoCliente = await Cliente.create({
      rut,
      tipo_cliente: tipo_cliente || 'persona',
      nombre,
      nombre_fantasia,
      codigo_cliente,
      telefono,
      celular,
      email,
      razon_social,
      direccion,
      ciudad,
      comuna,
      giro,
      contacto_pago,
      email_pago,
      telefono_pago,
      contacto_comercial,
      email_comercial,
      descuento_default: descuento_default || 0,
      linea_credito: linea_credito || 0,
      dias_credito: dias_credito || 0,
      forma_pago_default,
      lista_precios,
      restringir_si_vencido: restringir_si_vencido || false,
      dias_adicionales_morosidad: dias_adicionales_morosidad || 0,
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
      nombre_fantasia,
      codigo_cliente,
      telefono,
      celular,
      email,
      razon_social,
      direccion,
      ciudad,
      comuna,
      giro,
      contacto_pago,
      email_pago,
      telefono_pago,
      contacto_comercial,
      email_comercial,
      descuento_default,
      linea_credito,
      dias_credito,
      forma_pago_default,
      lista_precios,
      restringir_si_vencido,
      dias_adicionales_morosidad,
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
      nombre_fantasia,
      codigo_cliente,
      telefono,
      celular,
      email,
      razon_social,
      direccion,
      ciudad,
      comuna,
      giro,
      contacto_pago,
      email_pago,
      telefono_pago,
      contacto_comercial,
      email_comercial,
      descuento_default,
      linea_credito,
      dias_credito,
      forma_pago_default,
      lista_precios,
      restringir_si_vencido,
      dias_adicionales_morosidad,
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

/**
 * @openapi
 * /admin/clientes/importar:
 *   post:
 *     summary: Importar clientes masivamente desde JSON (convertido de Excel)
 *     tags:
 *       - admin
 */
router.post('/clientes/importar', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { clientes: clientesData, modo = 'crear_actualizar' } = req.body;
    // modo: 'solo_crear' | 'solo_actualizar' | 'crear_actualizar'

    if (!Array.isArray(clientesData) || clientesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de clientes'
      });
    }

    console.log(`📥 [IMPORTAR] Procesando ${clientesData.length} clientes (modo: ${modo})`);

    const resultados = {
      creados: 0,
      actualizados: 0,
      errores: [] as { rut: string; error: string }[],
      omitidos: 0
    };

    for (const clienteData of clientesData) {
      try {
        // Validar RUT
        if (!clienteData.rut) {
          resultados.errores.push({ rut: 'N/A', error: 'RUT es obligatorio' });
          continue;
        }

        // Normalizar RUT (quitar puntos, mantener guión)
        const rutNormalizado = clienteData.rut.toString().replace(/\./g, '').toUpperCase();

        // Buscar si ya existe
        const existente = await Cliente.findOne({
          where: { rut: rutNormalizado },
          transaction
        });

        // Determinar tipo de cliente
        const tipoCliente = clienteData.tipo?.toLowerCase() === 'empresa' ||
                           clienteData.tipo_cliente?.toLowerCase() === 'empresa'
                           ? 'empresa' : 'persona';

        // Extraer valores primero para calcular datos_completos
        const nombre = clienteData.nombre || clienteData['Nombre/Razón social'] || null;
        const razonSocial = clienteData.razon_social || clienteData['Nombre/Razón social'] || null;
        const direccion = clienteData.direccion || clienteData['Dirección'] || null;
        const giro = clienteData.giro || clienteData['Giro'] || null;

        // Calcular si los datos están completos
        const datosCompletos = tipoCliente === 'empresa'
          ? !!(razonSocial && direccion && giro)
          : !!nombre;

        // Mapear campos del Excel a campos del modelo
        const datosCliente = {
          rut: rutNormalizado,
          tipo_cliente: tipoCliente,
          nombre,
          nombre_fantasia: clienteData.nombre_fantasia || clienteData['Nombre fantasía'] || null,
          codigo_cliente: clienteData.codigo || clienteData.codigo_cliente || clienteData['Código'] || null,
          razon_social: razonSocial,
          giro,
          direccion,
          ciudad: clienteData.ciudad || clienteData['Ciudad'] || null,
          comuna: clienteData.comuna || clienteData['Comuna'] || null,
          telefono: clienteData.telefono || clienteData['Teléfono'] || null,
          celular: clienteData.celular || clienteData['Celular'] || null,
          email: clienteData.email || clienteData['Correo electrónico'] || null,
          contacto_pago: clienteData.contacto_pago || clienteData['Contacto pago'] || null,
          email_pago: clienteData.email_pago || clienteData['Correo electrónico pago'] || null,
          telefono_pago: clienteData.telefono_pago || clienteData['Teléfono pago'] || null,
          contacto_comercial: clienteData.contacto_comercial || clienteData['Contacto comercial'] || null,
          email_comercial: clienteData.email_comercial || clienteData['Correo(s) electrónico(s) comercial'] || null,
          descuento_default: parseFloat(clienteData.descuento || clienteData['Descuento'] || 0) || 0,
          linea_credito: parseFloat(clienteData.linea_credito || clienteData['Línea de crédito asignada'] || 0) || 0,
          dias_credito: parseInt(clienteData.dias_credito || clienteData['Crédito'] || 0) || 0,
          forma_pago_default: clienteData.forma_pago || clienteData['Forma de pago'] || null,
          lista_precios: clienteData.lista_precios || clienteData['Lista de precios'] || null,
          restringir_si_vencido: clienteData.restringir_si_vencido === true ||
                                 clienteData['Restringir si existe un documento vencido'] === 'SI',
          dias_adicionales_morosidad: parseInt(clienteData.dias_adicionales_morosidad ||
                                               clienteData['Días adicionales de morosidad'] || 0) || 0,
          activo: clienteData.estado !== 'Inactivo' && clienteData['Estado'] !== 'Inactivo',
          datos_completos: datosCompletos
        };

        if (existente) {
          // Cliente ya existe
          if (modo === 'solo_crear') {
            resultados.omitidos++;
            continue;
          }

          // Actualizar cliente existente
          await existente.update({
            ...datosCliente,
            rut: existente.rut, // No cambiar RUT
            fecha_actualizacion: new Date()
          }, { transaction });

          resultados.actualizados++;
        } else {
          // Cliente nuevo
          if (modo === 'solo_actualizar') {
            resultados.omitidos++;
            continue;
          }

          // Crear nuevo cliente
          await Cliente.create(datosCliente, { transaction });
          resultados.creados++;
        }

      } catch (error: any) {
        resultados.errores.push({
          rut: clienteData.rut || 'N/A',
          error: error.message || 'Error desconocido'
        });
      }
    }

    await transaction.commit();

    const totalProcesados = resultados.creados + resultados.actualizados;
    console.log(`✅ [IMPORTAR] Completado: ${resultados.creados} creados, ${resultados.actualizados} actualizados, ${resultados.errores.length} errores`);

    res.json({
      success: true,
      data: {
        total_enviados: clientesData.length,
        creados: resultados.creados,
        actualizados: resultados.actualizados,
        omitidos: resultados.omitidos,
        errores: resultados.errores.length,
        detalle_errores: resultados.errores.slice(0, 20) // Máximo 20 errores en respuesta
      },
      message: `Importación completada: ${totalProcesados} clientes procesados`
    });

  } catch (error: any) {
    await transaction.rollback();
    console.error('❌ Error en importación masiva:', error);
    res.status(500).json({
      success: false,
      message: `Error en importación: ${error.message}`
    });
  }
});

export default router;