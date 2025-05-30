import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { Categoria } from '../models/Categoria.model';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

const router = Router();
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: productos-admin
 *     description: Administración y gestión de productos
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     CrearProductoCompleto:
 *       type: object
 *       required:
 *         - categoria
 *         - modelo
 *       properties:
 *         categoria:
 *           type: string
 *           example: "TELAS"
 *           description: "Nombre de la categoría (TELAS, CORCHETES, PATAS, BOTONES)"
 *         tipo:
 *           type: string
 *           example: "LINO"
 *           description: "Tipo de producto (LINO, FELPA, ECOCUERO, etc.)"
 *         modelo:
 *           type: string
 *           example: "GABANNA"
 *           description: "Nombre del modelo (GABANNA, GUCCI, etc.)"
 *         codigo:
 *           type: string
 *           example: "TEL-LIN-GAB"
 *         descripcion:
 *           type: string
 *           example: "Tela de lino modelo Gabanna de alta calidad"
 *         unidad_medida:
 *           type: string
 *           enum: [metro, unidad, kilogramo, litros]
 *           example: "metro"
 *         stock_minimo_total:
 *           type: number
 *           example: 50
 *         opciones:
 *           type: array
 *           description: "Variantes del producto (colores, medidas, etc.)"
 *           items:
 *             type: object
 *             properties:
 *               color:
 *                 type: string
 *                 example: "Azul"
 *               medida:
 *                 type: string
 *                 example: "71"
 *               material:
 *                 type: string
 *                 example: "100% Lino"
 *               descripcion:
 *                 type: string
 *               stock_minimo:
 *                 type: number
 *                 example: 10
 *         modalidades:
 *           type: array
 *           description: "Modalidades de venta a nivel de producto"
 *           items:
 *             type: object
 *             required:
 *               - nombre
 *               - precio_neto
 *               - precio_factura
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "METRO"
 *                 description: "METRO, ROLLO, KILO, UNIDAD, EMBALAJE, etc."
 *               descripcion:
 *                 type: string
 *                 example: "Venta por metro lineal"
 *               cantidad_base:
 *                 type: number
 *                 example: 1
 *               es_cantidad_variable:
 *                 type: boolean
 *                 example: true
 *               minimo_cantidad:
 *                 type: number
 *                 example: 0.5
 *               precio_costo:
 *                 type: number
 *                 example: 5000
 *               precio_neto:
 *                 type: number
 *                 example: 8500
 *               precio_factura:
 *                 type: number
 *                 example: 8000
 */

/**
 * @openapi
 * /productos-admin:
 *   post:
 *     summary: Crear producto completo con variantes y modalidades (modalidades a nivel de producto)
 *     tags:
 *       - productos-admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearProductoCompleto'
 *     responses:
 *       '201':
 *         description: Producto creado exitosamente
 *       '400':
 *         description: Error de validación
 *       '409':
 *         description: Ya existe un producto con ese código
 */
router.post('/', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      categoria,
      tipo,
      modelo,
      codigo,
      descripcion,
      unidad_medida = 'unidad',
      stock_minimo_total = 0,
      opciones = [],
      modalidades = []
    } = req.body;

    // Validaciones básicas
    if (!categoria || !modelo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: categoria, modelo'
      });
    }

    // Buscar o crear categoría
    let categoriaObj = await Categoria.findOne({
      where: { nombre: categoria }
    });
    if (!categoriaObj) {
      categoriaObj = await Categoria.create({
        nombre: categoria,
        descripcion: `Categoría ${categoria}`,
        activa: true
      }, { transaction });
    }

    // Generar código automáticamente si no se proporciona
    let codigoFinal = codigo;
    if (!codigoFinal) {
      const prefijo = categoria.substring(0, 3).toUpperCase();
      const tipoPrefix = tipo ? tipo.substring(0, 3).toUpperCase() : 'GEN';
      const modeloPrefix = modelo.substring(0, 3).toUpperCase();
      const ultimoProducto = await Producto.findOne({
        where: {
          codigo: {
            [Op.like]: `${prefijo}-${tipoPrefix}-${modeloPrefix}-%`
          }
        },
        order: [['codigo', 'DESC']],
        transaction
      });
      let numeroSiguiente = 1;
      if (ultimoProducto) {
        const partes = ultimoProducto.codigo.split('-');
        const ultimoNumero = parseInt(partes[partes.length - 1]);
        if (!isNaN(ultimoNumero)) numeroSiguiente = ultimoNumero + 1;
      }
      codigoFinal = `${prefijo}-${tipoPrefix}-${modeloPrefix}-${numeroSiguiente.toString().padStart(3, '0')}`;
    }

    // Verificar que el código no exista
    const productoExistente = await Producto.findOne({
      where: { codigo: codigoFinal }
    });
    if (productoExistente) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Ya existe un producto con el código ${codigoFinal}`
      });
    }

    // Crear producto base
    const producto = await Producto.create({
      codigo: codigoFinal,
      nombre: modelo,
      descripcion,
      id_categoria: categoriaObj.id_categoria,
      tipo: tipo || null,
      stock_minimo_total,
      unidad_medida,
      activo: true
    }, { transaction });

    // Crear variantes (si se envían)
    let totalVariantes = 0;
    if (Array.isArray(opciones)) {
      for (const opcion of opciones) {
        const { color, medida, material, descripcion: descVariante, stock_minimo = 0 } = opcion;
        // Generar SKU único
        const skuParts = [
          codigoFinal,
          color?.substring(0, 3).toUpperCase(),
          medida,
          material?.substring(0, 3).toUpperCase()
        ].filter(Boolean);
        const skuBase = skuParts.join('-');
        let sku = skuBase;
        let contador = 1;
        while (await VarianteProducto.findOne({ where: { sku }, transaction })) {
          sku = `${skuBase}-${contador}`;
          contador++;
        }
        await VarianteProducto.create({
          id_producto: producto.id_producto,
          sku,
          color,
          medida,
          material,
          descripcion: descVariante,
          stock_minimo,
          activo: true
        }, { transaction });
        totalVariantes++;
      }
    }

    // Crear modalidades a nivel de producto
    let totalModalidades = 0;
    if (Array.isArray(modalidades)) {
      for (const modalidad of modalidades) {
        const {
          nombre,
          descripcion: descModalidad,
          cantidad_base = 1,
          es_cantidad_variable = false,
          minimo_cantidad = 0,
          precio_costo = 0,
          precio_neto,
          precio_factura
        } = modalidad;
        if (!nombre || !precio_neto || !precio_factura) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Cada modalidad debe tener nombre, precio_neto y precio_factura'
          });
        }
        await ModalidadProducto.create({
          id_producto: producto.id_producto,
          nombre: nombre.toUpperCase(),
          descripcion: descModalidad,
          cantidad_base,
          es_cantidad_variable,
          minimo_cantidad,
          precio_costo,
          precio_neto,
          precio_neto_factura: precio_factura,
          activa: true
        }, { transaction });
        totalModalidades++;
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        id_producto: producto.id_producto,
        categoria: categoriaObj.nombre,
        tipo: tipo || null,
        modelo: modelo,
        codigo: codigoFinal,
        total_variantes_creadas: totalVariantes,
        total_modalidades_creadas: totalModalidades
      },
      message: `Producto creado exitosamente con ${totalVariantes} variantes y ${totalModalidades} modalidades`
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}/modalidad:
 *   post:
 *     summary: Agregar modalidad a un producto existente
 *     tags:
 *       - productos-admin
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
 *             required:
 *               - nombre
 *               - precio_neto
 *               - precio_factura
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               cantidad_base:
 *                 type: number
 *               es_cantidad_variable:
 *                 type: boolean
 *               minimo_cantidad:
 *                 type: number
 *               precio_costo:
 *                 type: number
 *               precio_neto:
 *                 type: number
 *               precio_factura:
 *                 type: number
 *     responses:
 *       '201':
 *         description: Modalidad agregada exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.post('/:id/modalidad', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      cantidad_base = 1,
      es_cantidad_variable = false,
      minimo_cantidad = 0,
      precio_costo = 0,
      precio_neto,
      precio_factura
    } = req.body;

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (!nombre || !precio_neto || !precio_factura) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: nombre, precio_neto, precio_factura'
      });
    }

    const modalidad = await ModalidadProducto.create({
      id_producto: producto.id_producto,
      nombre: nombre.toUpperCase(),
      descripcion,
      cantidad_base,
      es_cantidad_variable,
      minimo_cantidad,
      precio_costo,
      precio_neto,
      precio_neto_factura: precio_factura,
      activa: true
    });

    res.status(201).json({
      success: true,
      data: modalidad,
      message: 'Modalidad agregada exitosamente al producto'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}/variante:
 *   post:
 *     summary: Agregar variante a un producto existente
 *     tags:
 *       - productos-admin
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
 *               color:
 *                 type: string
 *               medida:
 *                 type: string
 *               material:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               stock_minimo:
 *                 type: number
 *     responses:
 *       '201':
 *         description: Variante agregada exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.post('/:id/variante', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { color, medida, material, descripcion, stock_minimo = 0 } = req.body;

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Generar SKU único
    const skuParts = [
      producto.codigo,
      color?.substring(0, 3).toUpperCase(),
      medida,
      material?.substring(0, 3).toUpperCase()
    ].filter(Boolean);
    const skuBase = skuParts.join('-');
    let sku = skuBase;
    let contador = 1;
    while (await VarianteProducto.findOne({ where: { sku } })) {
      sku = `${skuBase}-${contador}`;
      contador++;
    }

    const variante = await VarianteProducto.create({
      id_producto: producto.id_producto,
      sku,
      color,
      medida,
      material,
      descripcion,
      stock_minimo,
      activo: true
    });

    res.status(201).json({
      success: true,
      data: {
        id_variante: variante.id_variante_producto,
        sku: variante.sku
      },
      message: `Variante agregada exitosamente`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}:
 *   put:
 *     summary: Actualizar producto existente
 *     tags:
 *       - productos-admin
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
 *               modelo:
 *                 type: string
 *               tipo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               stock_minimo_total:
 *                 type: number
 *               unidad_medida:
 *                 type: string
 *                 enum: [metro, unidad, kilogramo, litros]
 *     responses:
 *       '200':
 *         description: Producto actualizado exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const producto = await Producto.findByPk(id, {
      include: [{ model: Categoria, as: 'categoria' }]
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Actualizar solo los campos permitidos
    const camposPermitidos = ['nombre', 'tipo', 'descripcion', 'stock_minimo_total', 'unidad_medida'];
    const datosActualizacion: any = {};
    camposPermitidos.forEach(campo => {
      if (updateData[campo] !== undefined) {
        if (campo === 'nombre') {
          datosActualizacion.nombre = updateData.modelo || updateData[campo];
        } else {
          datosActualizacion[campo] = updateData[campo];
        }
      }
    });

    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    datosActualizacion.fecha_actualizacion = new Date();
    await producto.update(datosActualizacion);

    const productoActualizado = await Producto.findByPk(id, {
      include: [{ model: Categoria, as: 'categoria' }]
    });

    res.json({
      success: true,
      data: {
        id_producto: productoActualizado!.id_producto,
        categoria: productoActualizado!.categoria?.nombre,
        tipo: productoActualizado!.tipo,
        modelo: productoActualizado!.nombre,
        codigo: productoActualizado!.codigo
      },
      message: 'Producto actualizado exitosamente'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}/activar:
 *   patch:
 *     summary: Activar/Desactivar producto
 *     tags:
 *       - productos-admin
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
 *             required:
 *               - activo
 *             properties:
 *               activo:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Estado del producto actualizado
 *       '404':
 *         description: Producto no encontrado
 */
router.patch('/:id/activar', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El campo activo debe ser verdadero o falso'
      });
    }

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    await producto.update({
      activo,
      fecha_actualizacion: new Date()
    });

    res.json({
      success: true,
      data: {
        id_producto: producto.id_producto,
        activo: producto.activo
      },
      message: `Producto ${activo ? 'activado' : 'desactivado'} exitosamente`
    });

  } catch (error) {
    next(error);
  }
});

export default router;
