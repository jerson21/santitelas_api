import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { StockPorBodega } from '../models/StockPorBodega.model';

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
 *               modalidades:
 *                 type: array
 *                 description: "Modalidades específicas para esta variante"
 *                 items:
 *                   type: object
 *                   required:
 *                     - nombre
 *                     - precio_neto
 *                     - precio_factura
 *                   properties:
 *                     nombre:
 *                       type: string
 *                       example: "METRO"
 *                       description: "METRO, ROLLO, KILO, UNIDAD, EMBALAJE, etc."
 *                     descripcion:
 *                       type: string
 *                       example: "Venta por metro lineal"
 *                     cantidad_base:
 *                       type: number
 *                       example: 1
 *                     es_cantidad_variable:
 *                       type: boolean
 *                       example: true
 *                     minimo_cantidad:
 *                       type: number
 *                       example: 0.5
 *                     precio_costo:
 *                       type: number
 *                       example: 5000
 *                     precio_neto:
 *                       type: number
 *                       example: 8500
 *                     precio_factura:
 *                       type: number
 *                       example: 8000
 */

/**
 * @openapi
 * /productos-admin:
 *   post:
 *     summary: Crear producto completo con variantes y modalidades (modalidades por variante)
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
      opciones = []
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

    // ✅ CREAR VARIANTES CON SUS MODALIDADES ESPECÍFICAS
    let totalVariantes = 0;
    let totalModalidades = 0;
    
    if (Array.isArray(opciones) && opciones.length > 0) {
      for (const opcion of opciones) {
        const { 
          color, 
          medida, 
          material, 
          descripcion: descVariante, 
          stock_minimo = 0,
          modalidades: modalidadesVariante = []
        } = opcion;
        
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
        
        const variante = await VarianteProducto.create({
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

        // ✅ CREAR MODALIDADES PARA ESTA VARIANTE ESPECÍFICA
        if (Array.isArray(modalidadesVariante)) {
          for (const modalidad of modalidadesVariante) {
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
                message: `Cada modalidad debe tener nombre, precio_neto y precio_factura. Error en variante: ${sku}`
              });
            }
            
            await ModalidadProducto.create({
              id_variante_producto: variante.id_variante_producto,
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
      }
    } else {
      // Si no se envían opciones, crear una variante estándar
      const variante = await VarianteProducto.create({
        id_producto: producto.id_producto,
        sku: `${codigoFinal}-STD`,
        descripcion: 'Variante estándar',
        stock_minimo: 0,
        activo: true
      }, { transaction });
      
      totalVariantes++;

      // Modalidades automáticas según unidad de medida
      if (unidad_medida === 'metro') {
        await ModalidadProducto.create({
          id_variante_producto: variante.id_variante_producto,
          nombre: 'METRO',
          descripcion: 'Venta por metro',
          cantidad_base: 1,
          es_cantidad_variable: true,
          minimo_cantidad: 0.1,
          precio_costo: 0,
          precio_neto: 1000,
          precio_neto_factura: 840,
          activa: true
        }, { transaction });
        totalModalidades++;
      } else {
        await ModalidadProducto.create({
          id_variante_producto: variante.id_variante_producto,
          nombre: 'UNIDAD',
          descripcion: 'Venta por unidad',
          cantidad_base: 1,
          es_cantidad_variable: false,
          minimo_cantidad: 1,
          precio_costo: 0,
          precio_neto: 1000,
          precio_neto_factura: 840,
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
 * /productos-admin/{id}/variante/{varianteId}/modalidad:
 *   post:
 *     summary: Agregar modalidad a una variante específica
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
 *       - in: path
 *         name: varianteId
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
 *         description: Producto o variante no encontrado
 */
router.post('/:id/variante/:varianteId/modalidad', async (req, res, next) => {
  try {
    const { id, varianteId } = req.params;
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

    // Verificar que el producto existe
    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Verificar que la variante existe y pertenece al producto
    const variante = await VarianteProducto.findOne({
      where: {
        id_variante_producto: varianteId,
        id_producto: id
      }
    });
    
    if (!variante) {
      return res.status(404).json({
        success: false,
        message: 'Variante no encontrada o no pertenece al producto'
      });
    }

    if (!nombre || !precio_neto || !precio_factura) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: nombre, precio_neto, precio_factura'
      });
    }

    // ✅ CREAR MODALIDAD PARA LA VARIANTE ESPECÍFICA
    const modalidad = await ModalidadProducto.create({
      id_variante_producto: variante.id_variante_producto,
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
      message: 'Modalidad agregada exitosamente a la variante'
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
 *               modalidades:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                     descripcion:
 *                       type: string
 *                     precio_neto:
 *                       type: number
 *                     precio_factura:
 *                       type: number
 *     responses:
 *       '201':
 *         description: Variante agregada exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.post('/:id/variante', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
      color, 
      medida, 
      material, 
      descripcion, 
      stock_minimo = 0,
      modalidades = []
    } = req.body;

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
    while (await VarianteProducto.findOne({ where: { sku }, transaction })) {
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
    }, { transaction });

    // ✅ CREAR MODALIDADES PARA LA NUEVA VARIANTE
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
        
        if (nombre && precio_neto && precio_factura) {
          await ModalidadProducto.create({
            id_variante_producto: variante.id_variante_producto,
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
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        id_variante: variante.id_variante_producto,
        sku: variante.sku,
        modalidades_creadas: totalModalidades
      },
      message: `Variante agregada exitosamente con ${totalModalidades} modalidades`
    });

  } catch (error) {
    await transaction.rollback();
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


/**
 * @openapi
 * /productos-admin/modalidad/{modalidadId}:
 *   put:
 *     summary: Actualizar modalidad existente
 *     tags:
 *       - productos-admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modalidadId
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
 *               precios:
 *                 type: object
 *                 properties:
 *                   costo:
 *                     type: number
 *                   neto:
 *                     type: number
 *                   factura:
 *                     type: number
 *     responses:
 *       '200':
 *         description: Modalidad actualizada exitosamente
 *       '404':
 *         description: Modalidad no encontrada
 */
router.put('/modalidad/:modalidadId', async (req, res, next) => {
  try {
    const { modalidadId } = req.params;
    const updateData = req.body;

    const modalidad = await ModalidadProducto.findByPk(modalidadId);
    
    if (!modalidad) {
      return res.status(404).json({
        success: false,
        message: 'Modalidad no encontrada'
      });
    }

    // Si se envían precios como objeto, procesarlos
    if (updateData.precios) {
      if (updateData.precios.costo !== undefined) {
        updateData.precio_costo = updateData.precios.costo;
      }
      if (updateData.precios.neto !== undefined) {
        updateData.precio_neto = updateData.precios.neto;
      }
      if (updateData.precios.factura !== undefined) {
        updateData.precio_neto_factura = updateData.precios.factura;
      }
      delete updateData.precios;
    }

    // Campos permitidos para actualización
    const camposPermitidos = [
      'nombre', 'descripcion', 'cantidad_base', 
      'es_cantidad_variable', 'minimo_cantidad', 
      'precio_costo', 'precio_neto', 'precio_neto_factura'
    ];

    const datosActualizacion: any = {};
    camposPermitidos.forEach(campo => {
      if (updateData[campo] !== undefined) {
        datosActualizacion[campo] = updateData[campo];
      }
    });

    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    datosActualizacion.fecha_actualizacion = new Date();
    await modalidad.update(datosActualizacion);

    res.json({
      success: true,
      data: modalidad,
      message: 'Modalidad actualizada exitosamente'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/variante/{varianteId}:
 *   put:
 *     summary: Actualizar variante existente
 *     tags:
 *       - productos-admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: varianteId
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
 *               activo:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Variante actualizada exitosamente
 *       '404':
 *         description: Variante no encontrada
 */
router.put('/variante/:varianteId', async (req, res, next) => {
  try {
    const { varianteId } = req.params;
    const updateData = req.body;

    const variante = await VarianteProducto.findByPk(varianteId);
    
    if (!variante) {
      return res.status(404).json({
        success: false,
        message: 'Variante no encontrada'
      });
    }

    const camposPermitidos = [
      'color', 'medida', 'material', 
      'descripcion', 'stock_minimo', 'activo'
    ];

    const datosActualizacion: any = {};
    camposPermitidos.forEach(campo => {
      if (updateData[campo] !== undefined) {
        datosActualizacion[campo] = updateData[campo];
      }
    });

    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    datosActualizacion.fecha_actualizacion = new Date();
    await variante.update(datosActualizacion);

    res.json({
      success: true,
      data: variante,
      message: 'Variante actualizada exitosamente'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}:
 *   delete:
 *     summary: Eliminar producto (soft delete)
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
 *     responses:
 *       '200':
 *         description: Producto eliminado exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Soft delete - solo desactivar
    await producto.update({
      activo: false,
      fecha_actualizacion: new Date()
    });

    // También desactivar todas las variantes
    await VarianteProducto.update(
      { activo: false },
      { where: { id_producto: id } }
    );

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    next(error);
  }
});

// Agregar estos endpoints en productos-admin.routes.ts

/**
 * @openapi
 * /productos-admin/variante/{varianteId}:
 *   delete:
 *     summary: Eliminar variante (soft delete)
 *     tags:
 *       - productos-admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: varianteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Variante eliminada exitosamente
 *       '404':
 *         description: Variante no encontrada
 *       '400':
 *         description: No se puede eliminar la variante
 */
router.delete('/variante/:varianteId', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { varianteId } = req.params;
    
    const variante = await VarianteProducto.findByPk(varianteId, {
      include: [{
        model: Producto,
        as: 'producto'
      }]
    });
    
    if (!variante) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Variante no encontrada'
      });
    }

    // Verificar que no sea la última variante activa del producto
    const variantesActivas = await VarianteProducto.count({
      where: {
        id_producto: variante.id_producto,
        activo: true
      }
    });

    if (variantesActivas <= 1) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar la última variante del producto. El producto debe tener al menos una variante activa.'
      });
    }

    // Verificar si tiene stock
    const stockTotal = await StockPorBodega.sum('cantidad_disponible', {
      where: { id_variante_producto: varianteId }
    });

    if (stockTotal > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar la variante porque tiene ${stockTotal} unidades en stock`
      });
    }

    // Soft delete - desactivar variante y sus modalidades
    await variante.update({ activo: false }, { transaction });
    
    // Desactivar todas las modalidades de esta variante
    await ModalidadProducto.update(
      { activa: false },
      { 
        where: { id_variante_producto: varianteId },
        transaction 
      }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: 'Variante eliminada exitosamente'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/modalidad/{modalidadId}:
 *   delete:
 *     summary: Eliminar modalidad (soft delete)
 *     tags:
 *       - productos-admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modalidadId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Modalidad eliminada exitosamente
 *       '404':
 *         description: Modalidad no encontrada
 *       '400':
 *         description: No se puede eliminar la modalidad
 */
router.delete('/modalidad/:modalidadId', async (req, res, next) => {
  try {
    const { modalidadId } = req.params;
    
    const modalidad = await ModalidadProducto.findByPk(modalidadId, {
      include: [{
        model: VarianteProducto,
        as: 'variante'
      }]
    });
    
    if (!modalidad) {
      return res.status(404).json({
        success: false,
        message: 'Modalidad no encontrada'
      });
    }

    // Verificar que no sea la última modalidad activa de la variante
    const modalidadesActivas = await ModalidadProducto.count({
      where: {
        id_variante_producto: modalidad.id_variante_producto,
        activa: true
      }
    });

    if (modalidadesActivas <= 1) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar la última modalidad de la variante. Cada variante debe tener al menos una modalidad activa.'
      });
    }

    // Soft delete - desactivar modalidad
    await modalidad.update({ activa: false });

    res.json({
      success: true,
      message: 'Modalidad eliminada exitosamente'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos-admin/{id}/duplicar:
 *   post:
 *     summary: Duplicar producto completo con todas sus variantes y modalidades
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nuevo_nombre:
 *                 type: string
 *                 description: Nombre para el producto duplicado
 *               nuevo_codigo:
 *                 type: string
 *                 description: Código para el producto duplicado (opcional, se genera automáticamente si no se proporciona)
 *     responses:
 *       '201':
 *         description: Producto duplicado exitosamente
 *       '404':
 *         description: Producto no encontrado
 */
router.post('/:id/duplicar', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { nuevo_nombre, nuevo_codigo } = req.body;

    // Obtener producto original con todas sus relaciones
    const productoOriginal = await Producto.findByPk(id, {
      include: [
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: ModalidadProducto,
            as: 'modalidades',
            where: { activa: true },
            required: false
          }]
        }
      ]
    });

    if (!productoOriginal) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Generar nuevo código si no se proporciona
    let codigoFinal = nuevo_codigo;
    if (!codigoFinal) {
      const timestamp = Date.now().toString().slice(-4);
      codigoFinal = `${productoOriginal.codigo}-COPIA-${timestamp}`;
    }

    // Verificar que el código no exista
    const codigoExiste = await Producto.findOne({
      where: { codigo: codigoFinal }
    });

    if (codigoExiste) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Ya existe un producto con el código ${codigoFinal}`
      });
    }

    // Crear copia del producto
    const datosProducto = productoOriginal.toJSON();
    delete datosProducto.id_producto;
    delete datosProducto.fecha_creacion;
    delete datosProducto.fecha_actualizacion;
    
    const productoNuevo = await Producto.create({
      ...datosProducto,
      nombre: nuevo_nombre || `${datosProducto.nombre} (COPIA)`,
      codigo: codigoFinal,
      activo: true
    }, { transaction });

    // Copiar variantes y modalidades
    let totalVariantes = 0;
    let totalModalidades = 0;

    for (const variante of datosProducto.variantes || []) {
      const datosVariante = { ...variante };
      delete datosVariante.id_variante_producto;
      delete datosVariante.fecha_creacion;
      delete datosVariante.fecha_actualizacion;
      
      // Generar nuevo SKU
      const nuevoSKU = `${datosVariante.sku}-${Date.now().toString().slice(-4)}`;
      
      const varianteNueva = await VarianteProducto.create({
        ...datosVariante,
        id_producto: productoNuevo.id_producto,
        sku: nuevoSKU,
        activo: true
      }, { transaction });
      
      totalVariantes++;

      // Copiar modalidades
      for (const modalidad of variante.modalidades || []) {
        const datosModalidad = { ...modalidad };
        delete datosModalidad.id_modalidad;
        delete datosModalidad.fecha_creacion;
        delete datosModalidad.fecha_actualizacion;
        
        await ModalidadProducto.create({
          ...datosModalidad,
          id_variante_producto: varianteNueva.id_variante_producto,
          activa: true
        }, { transaction });
        
        totalModalidades++;
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        id_producto: productoNuevo.id_producto,
        codigo: productoNuevo.codigo,
        nombre: productoNuevo.nombre,
        variantes_copiadas: totalVariantes,
        modalidades_copiadas: totalModalidades
      },
      message: `Producto duplicado exitosamente con ${totalVariantes} variantes y ${totalModalidades} modalidades`
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});


export default router;