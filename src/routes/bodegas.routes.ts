// src/routes/bodegas.routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Bodega } from '../models/Bodega.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Producto } from '../models/Producto.model';
import { Categoria } from '../models/Categoria.model';

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: bodegas
 *     description: Gestión de bodegas y almacenes
 */

/**
 * @openapi
 * /bodegas:
 *   get:
 *     summary: Listar todas las bodegas
 *     tags:
 *       - bodegas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activa
 *         schema:
 *           type: boolean
 *         description: Filtrar por bodegas activas/inactivas
 *       - in: query
 *         name: punto_venta
 *         schema:
 *           type: boolean
 *         description: Solo bodegas que son punto de venta
 *     responses:
 *       '200':
 *         description: Lista de bodegas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_bodega:
 *                         type: integer
 *                         example: 1
 *                       codigo:
 *                         type: string
 *                         example: "BOD001"
 *                       nombre:
 *                         type: string
 *                         example: "Bodega Principal"
 *                       descripcion:
 *                         type: string
 *                         example: "Bodega principal del almacén"
 *                       direccion:
 *                         type: string
 *                         example: "Av. Principal 123"
 *                       es_punto_venta:
 *                         type: boolean
 *                         example: true
 *                       activa:
 *                         type: boolean
 *                         example: true
 */
router.get('/', async (req, res, next) => {
  try {
    const { activa, punto_venta } = req.query;
    
    const whereClause: any = {};
    if (activa !== undefined) whereClause.activa = activa === 'true';
    if (punto_venta !== undefined) whereClause.es_punto_venta = punto_venta === 'true';

    const bodegas = await Bodega.findAll({
      where: whereClause,
      order: [['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: bodegas
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bodegas:
 *   post:
 *     summary: Crear nueva bodega
 *     tags:
 *       - bodegas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *               - nombre
 *             properties:
 *               codigo:
 *                 type: string
 *                 example: "BOD001"
 *               nombre:
 *                 type: string
 *                 example: "Bodega Principal"
 *               descripcion:
 *                 type: string
 *                 example: "Bodega principal del almacén"
 *               direccion:
 *                 type: string
 *                 example: "Av. Principal 123"
 *               es_punto_venta:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       '201':
 *         description: Bodega creada exitosamente
 *       '409':
 *         description: Ya existe una bodega con ese código
 */
router.post('/', async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, direccion, es_punto_venta } = req.body;
    
    // Verificar si el código ya existe
    const existingBodega = await Bodega.findOne({
      where: { codigo }
    });
    
    if (existingBodega) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una bodega con ese código'
      });
    }

    const bodega = await Bodega.create({
      codigo,
      nombre,
      descripcion,
      direccion,
      es_punto_venta: es_punto_venta || false
    });

    res.status(201).json({
      success: true,
      data: bodega,
      message: 'Bodega creada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bodegas/{id}:
 *   get:
 *     summary: Obtener bodega por ID con su stock
 *     tags:
 *       - bodegas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bodega encontrada con su stock
 *       '404':
 *         description: Bodega no encontrada
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const bodega = await Bodega.findByPk(id, {
      include: [{
        model: StockPorBodega,
        as: 'stock',
        include: [{
          model: Producto,
          as: 'producto',
          include: [{
            model: Categoria,
            as: 'categoria',
            attributes: ['nombre']
          }],
          attributes: ['id_producto', 'nombre', 'codigo', 'unidad_medida']
        }],
        where: { cantidad_disponible: { [Symbol.for('gt')]: 0 } },
        required: false
      }]
    });

    if (!bodega) {
      return res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
    }

    res.json({
      success: true,
      data: bodega
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bodegas/{id}:
 *   put:
 *     summary: Actualizar bodega
 *     tags:
 *       - bodegas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               direccion:
 *                 type: string
 *               es_punto_venta:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Bodega actualizada exitosamente
 *       '404':
 *         description: Bodega no encontrada
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const bodega = await Bodega.findByPk(id);
    if (!bodega) {
      return res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
    }

    await bodega.update(updateData);

    res.json({
      success: true,
      data: bodega,
      message: 'Bodega actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /bodegas/{id}:
 *   delete:
 *     summary: Desactivar bodega
 *     tags:
 *       - bodegas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bodega desactivada exitosamente
 *       '404':
 *         description: Bodega no encontrada
 *       '400':
 *         description: No se puede desactivar, tiene stock
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const bodega = await Bodega.findByPk(id, {
      include: [{
        model: StockPorBodega,
        as: 'stock',
        where: { cantidad_disponible: { [Symbol.for('gt')]: 0 } },
        required: false
      }]
    });

    if (!bodega) {
      return res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
    }

    // Verificar si tiene stock
    if (bodega.stock && bodega.stock.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede desactivar la bodega porque tiene ${bodega.stock.length} productos con stock`
      });
    }

    await bodega.update({ activa: false });

    res.json({
      success: true,
      message: 'Bodega desactivada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

export default router;