// src/routes/categorias.routes.ts
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Categoria } from '../models/Categoria.model';
import { Producto } from '../models/Producto.model';

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: categorias
 *     description: Gestión de categorías de productos
 */

/**
 * @openapi
 * /categorias:
 *   get:
 *     summary: Listar todas las categorías
 *     tags:
 *       - categorias
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activa
 *         schema:
 *           type: boolean
 *         description: Filtrar por categorías activas/inactivas
 *       - in: query
 *         name: con_productos
 *         schema:
 *           type: boolean
 *         description: Incluir conteo de productos
 *     responses:
 *       '200':
 *         description: Lista de categorías
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
 *                       id_categoria:
 *                         type: integer
 *                         example: 1
 *                       nombre:
 *                         type: string
 *                         example: "Telas"
 *                       descripcion:
 *                         type: string
 *                         example: "Categoría para telas"
 *                       activa:
 *                         type: boolean
 *                         example: true
 *                       total_productos:
 *                         type: integer
 *                         example: 15
 */
router.get('/', async (req, res, next) => {
  try {
    const { activa, con_productos } = req.query;
    
    const whereClause: any = {};
    if (activa !== undefined) whereClause.activa = activa === 'true';

    const includeOptions = [];
    if (con_productos === 'true') {
      includeOptions.push({
        model: Producto,
        as: 'productos',
        attributes: ['id_producto'],
        where: { activo: true },
        required: false
      });
    }

    const categorias = await Categoria.findAll({
      where: whereClause,
      include: includeOptions,
      order: [['nombre', 'ASC']]
    });

    // Agregar conteo de productos si se solicitó
    const categoriasConConteo = categorias.map(cat => {
      const categoria = cat.toJSON();
      if (con_productos === 'true') {
        categoria.total_productos = categoria.productos?.length || 0;
        delete categoria.productos; // No enviar el array completo
      }
      return categoria;
    });

    res.json({
      success: true,
      data: categoriasConConteo
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /categorias:
 *   post:
 *     summary: Crear nueva categoría
 *     tags:
 *       - categorias
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Telas de Algodón"
 *               descripcion:
 *                 type: string
 *                 example: "Categoría para telas 100% algodón"
 *     responses:
 *       '201':
 *         description: Categoría creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Categoría creada exitosamente"
 *       '409':
 *         description: Ya existe una categoría con ese nombre
 */
router.post('/', async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // Verificar si ya existe
    const existingCategoria = await Categoria.findOne({
      where: { nombre }
    });
    
    if (existingCategoria) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    const categoria = await Categoria.create({
      nombre,
      descripcion
    });

    res.status(201).json({
      success: true,
      data: categoria,
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /categorias/{id}:
 *   get:
 *     summary: Obtener categoría por ID
 *     tags:
 *       - categorias
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la categoría
 *     responses:
 *       '200':
 *         description: Categoría encontrada
 *       '404':
 *         description: Categoría no encontrada
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const categoria = await Categoria.findByPk(id, {
      include: [{
        model: Producto,
        as: 'productos',
        where: { activo: true },
        required: false,
        attributes: ['id_producto', 'nombre', 'codigo', 'precio_boleta']
      }]
    });

    if (!categoria) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      data: categoria
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /categorias/{id}:
 *   put:
 *     summary: Actualizar categoría
 *     tags:
 *       - categorias
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
 *     responses:
 *       '200':
 *         description: Categoría actualizada exitosamente
 *       '404':
 *         description: Categoría no encontrada
 *       '409':
 *         description: Ya existe una categoría con ese nombre
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;
    
    const categoria = await Categoria.findByPk(id);
    if (!categoria) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Verificar nombre único si cambió
    if (nombre && nombre !== categoria.nombre) {
      const existingCategoria = await Categoria.findOne({
        where: { nombre }
      });
      
      if (existingCategoria) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una categoría con ese nombre'
        });
      }
    }

    await categoria.update({ nombre, descripcion });

    res.json({
      success: true,
      data: categoria,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /categorias/{id}:
 *   delete:
 *     summary: Desactivar categoría
 *     tags:
 *       - categorias
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
 *         description: Categoría desactivada exitosamente
 *       '404':
 *         description: Categoría no encontrada
 *       '400':
 *         description: No se puede desactivar, tiene productos asociados
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const categoria = await Categoria.findByPk(id, {
      include: [{
        model: Producto,
        as: 'productos',
        where: { activo: true },
        required: false
      }]
    });

    if (!categoria) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Verificar si tiene productos activos
    if (categoria.productos && categoria.productos.length > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede desactivar la categoría porque tiene ${categoria.productos.length} productos activos asociados`
      });
    }

    await categoria.update({ activa: false });

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

export default router;