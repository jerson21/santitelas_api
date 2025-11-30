import { Router, Request, Response, NextFunction } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Categoria } from '../models/Categoria.model';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';
// --- Interfaces para Tipado Fuerte ---
// Estas interfaces definen la estructura esperada en el `req.body`
// para las operaciones de creación y actualización.

interface IModalidadBody {
    nombre: string;
    descripcion?: string;
    cantidad_base?: number;
    es_cantidad_variable?: boolean;
    minimo_cantidad?: number;
    precio_costo?: number;
    precio_neto: number;
    precio_factura: number; // El frontend lo envía así, aunque en BD sea precio_neto_factura
    afecto_descuento_ticket?: boolean;
}

interface IOpcionBody {
    color?: string;
    medida?: string;
    material?: string;
    descripcion?: string;
    stock_minimo?: number;
    modalidades: IModalidadBody[];
}
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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
            preciosBase // NUEVO: recibir precios base del frontend
        } = req.body;

        // Validaciones
        if (!categoria || !modelo) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: categoria y modelo son obligatorios.'
            });
        }
        
        if (!opciones || opciones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Un producto nuevo debe tener al menos una variante (opción).'
            });
        }

        // NUEVA VALIDACIÓN: Verificar que cada variante tenga modalidades con precios
        for (const opcion of opciones) {
            if (!opcion.modalidades || opcion.modalidades.length === 0) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `La variante con color "${opcion.color || 'N/A'}" debe tener al menos una modalidad de venta.`
                });
            }
            
            for (const modalidad of opcion.modalidades) {
                if (!modalidad.nombre || !modalidad.precio_neto || modalidad.precio_neto <= 0) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Cada modalidad debe tener un nombre y precios válidos.`
                    });
                }
                
                // NUEVO: Validar que precio_factura sea coherente con precio_neto
                const precio_factura_esperado = Math.round(modalidad.precio_neto * 1.19);
                if (Math.abs(modalidad.precio_factura - precio_factura_esperado) > 1) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `El precio factura debe ser el precio neto + 19% IVA.`
                    });
                }
            }
        }

        // Crear categoría si no existe
        let categoriaObj = await Categoria.findOne({ where: { nombre: categoria }, transaction });
        if (!categoriaObj) {
            categoriaObj = await Categoria.create({
                nombre: categoria,
                descripcion: `Categoría ${categoria}`,
                activa: true
            }, { transaction });
        }

        // Generar código si no viene
        let codigoFinal = codigo;
        if (!codigoFinal) {
            const prefijo = categoria.substring(0, 3).toUpperCase();
            const modeloPrefix = modelo.substring(0, 3).toUpperCase();
            const timestamp = Date.now().toString().slice(-4);
            codigoFinal = `${prefijo}-${modeloPrefix}-${timestamp}`;
        }
        
        // Verificar código único
        const productoExistente = await Producto.findOne({ where: { codigo: codigoFinal }, transaction });
        if (productoExistente) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                message: `Ya existe un producto con el código ${codigoFinal}`
            });
        }

        // Crear producto
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

        // Crear variantes con modalidades
        const variantesCreadas = [];
        for (const opcion of opciones) {
            const { color, medida, material, descripcion: descVariante, stock_minimo = 0, modalidades = [] } = opcion;
            const sku = `${codigoFinal}-${variantesCreadas.length + 1}`;

            const variante = await VarianteProducto.create({
                id_producto: producto.id_producto,
                sku, color, medida, material,
                descripcion: descVariante,
                stock_minimo,
                activo: true
            }, { transaction });

            // IMPORTANTE: NO llamar al procedure crear_modalidades_para_variante
            // Las modalidades vienen completas desde el frontend

            const modalidadesCreadas = [];
            for (const mod of modalidades) {
                const modalidadCreada = await ModalidadProducto.create({
                    id_variante_producto: variante.id_variante_producto,
                    nombre: mod.nombre.toUpperCase(),
                    descripcion: mod.descripcion,
                    cantidad_base: mod.cantidad_base || 1,
                    es_cantidad_variable: mod.es_cantidad_variable || false,
                    minimo_cantidad: mod.minimo_cantidad || 0,
                    precio_costo: mod.precio_costo || 0,
                    precio_neto: mod.precio_neto,
                    precio_neto_factura: mod.precio_factura, // Frontend envía precio_factura
                    afecto_descuento_ticket: mod.afecto_descuento_ticket !== undefined ? mod.afecto_descuento_ticket : true,
                    activa: true
                }, { transaction });
                modalidadesCreadas.push(modalidadCreada.toJSON());
            }
            
            const varianteConModalidades: any = variante.toJSON();
            varianteConModalidades.modalidades = modalidadesCreadas;
            variantesCreadas.push(varianteConModalidades);
        }

        await transaction.commit();

        const productoFinal: any = producto.toJSON();
        productoFinal.categoria = categoriaObj.nombre;
        productoFinal.opciones = variantesCreadas;

        res.status(201).json({
            success: true,
            data: productoFinal,
            message: `Producto '${modelo}' creado exitosamente con ${variantesCreadas.length} variantes.`
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
      precio_factura,
      afecto_descuento_ticket = true
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
      afecto_descuento_ticket,
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
      modalidades = [] // Las modalidades DEBEN venir del frontend
    } = req.body;

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // VALIDAR que vengan modalidades
    if (!modalidades || modalidades.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos una modalidad de venta con precios'
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

    // NO LLAMAR AL PROCEDURE - crear modalidades directamente
    let totalModalidades = 0;
    for (const modalidad of modalidades) {
      const {
        nombre,
        descripcion: descModalidad,
        cantidad_base = 1,
        es_cantidad_variable = false,
        minimo_cantidad = 0,
        precio_costo = 0,
        precio_neto,
        precio_factura,
        afecto_descuento_ticket = true
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
          afecto_descuento_ticket,
          activa: true
        }, { transaction });
        totalModalidades++;
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

    console.log('📝 Datos recibidos para actualizar modalidad:', JSON.stringify(updateData, null, 2));

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
      'precio_costo', 'precio_neto', 'precio_neto_factura',
      'afecto_descuento_ticket'
    ];

    const datosActualizacion: any = {};
    camposPermitidos.forEach(campo => {
      console.log(`🔍 Verificando campo "${campo}": updateData["${campo}"] =`, updateData[campo]);
      if (updateData[campo] !== undefined) {
        datosActualizacion[campo] = updateData[campo];
      }
    });

    console.log('✅ Campos que se van a actualizar:', datosActualizacion);

    if (Object.keys(datosActualizacion).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    datosActualizacion.fecha_actualizacion = new Date();

    console.log('🚀 Ejecutando UPDATE con:', datosActualizacion);

    // Forzar la actualización incluso si el valor es el mismo
    await modalidad.update(datosActualizacion, {
      silent: false,
      fields: Object.keys(datosActualizacion)
    });
    await modalidad.reload(); // Recargar desde BD para obtener valores actualizados

    console.log('✅ Modalidad actualizada correctamente. afecto_descuento_ticket:', modalidad.afecto_descuento_ticket);

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


// ===========================
// 📤 EXPORTAR PRODUCTOS A EXCEL (Formato genérico por modalidades)
// ===========================
router.get('/exportar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoria, tipo, template } = req.query;
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    // Función para aplicar estilos a headers
    const applyHeaderStyle = (sheet: any) => {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      sheet.getRow(1).alignment = { horizontal: 'center' };
    };

    // Si es template, generar archivo con 2 hojas vacías
    if (template === 'true') {
      // Hoja 1: Productos
      const sheetProductos = workbook.addWorksheet('Productos');
      sheetProductos.columns = [
        { header: 'modelo', key: 'modelo', width: 30 },
        { header: 'categoria', key: 'categoria', width: 15 },
        { header: 'tipo', key: 'tipo', width: 15 },
        { header: 'unidad_medida', key: 'unidad_medida', width: 15 }
      ];
      applyHeaderStyle(sheetProductos);

      // Ejemplos para diferentes categorías
      sheetProductos.addRow({ modelo: 'GABANNA', categoria: 'TELAS', tipo: 'LINO', unidad_medida: 'metro' });
      sheetProductos.addRow({ modelo: 'CORCHETE GRANDE', categoria: 'CORCHETES', tipo: 'METALICO', unidad_medida: 'unidad' });
      sheetProductos.addRow({ modelo: 'RELLENO PREMIUM', categoria: 'RELLENOS', tipo: 'GUATA', unidad_medida: 'kilogramo' });
      sheetProductos.getRow(2).font = { italic: true, color: { argb: 'FF808080' } };
      sheetProductos.getRow(3).font = { italic: true, color: { argb: 'FF808080' } };
      sheetProductos.getRow(4).font = { italic: true, color: { argb: 'FF808080' } };

      // Hoja 2: Variantes con Modalidades (formato genérico)
      const sheetVariantes = workbook.addWorksheet('Variantes_Precios');
      sheetVariantes.columns = [
        { header: 'modelo', key: 'modelo', width: 25 },
        { header: 'color', key: 'color', width: 15 },
        { header: 'medida', key: 'medida', width: 12 },
        { header: 'material', key: 'material', width: 18 },
        { header: 'modalidad', key: 'modalidad', width: 12 },
        { header: 'precio_neto', key: 'precio_neto', width: 12 },
        { header: 'cantidad_base', key: 'cantidad_base', width: 14 },
        { header: 'es_variable', key: 'es_variable', width: 12 },
        { header: 'minimo_cant', key: 'minimo_cant', width: 12 }
      ];
      applyHeaderStyle(sheetVariantes);

      // Ejemplos variados
      // Tela con METRO y ROLLO
      sheetVariantes.addRow({ modelo: 'GABANNA', color: 'AZUL', medida: '1.50', material: '100% Lino', modalidad: 'METRO', precio_neto: 8500, cantidad_base: 1, es_variable: 'SI', minimo_cant: 0.5 });
      sheetVariantes.addRow({ modelo: 'GABANNA', color: 'AZUL', medida: '1.50', material: '100% Lino', modalidad: 'ROLLO', precio_neto: 170000, cantidad_base: 25, es_variable: 'NO', minimo_cant: 1 });
      sheetVariantes.addRow({ modelo: 'GABANNA', color: 'ROJO', medida: '1.50', material: '100% Lino', modalidad: 'METRO', precio_neto: 8500, cantidad_base: 1, es_variable: 'SI', minimo_cant: 0.5 });
      // Corchete con UNIDAD y CAJA
      sheetVariantes.addRow({ modelo: 'CORCHETE GRANDE', color: '', medida: '15mm', material: 'Metal', modalidad: 'UNIDAD', precio_neto: 500, cantidad_base: 1, es_variable: 'NO', minimo_cant: 1 });
      sheetVariantes.addRow({ modelo: 'CORCHETE GRANDE', color: '', medida: '15mm', material: 'Metal', modalidad: 'CAJA', precio_neto: 4500, cantidad_base: 10, es_variable: 'NO', minimo_cant: 1 });
      // Relleno con KILO
      sheetVariantes.addRow({ modelo: 'RELLENO PREMIUM', color: '', medida: '', material: 'Guata', modalidad: 'KILO', precio_neto: 12000, cantidad_base: 1, es_variable: 'SI', minimo_cant: 0.5 });

      for (let i = 2; i <= 7; i++) {
        sheetVariantes.getRow(i).font = { italic: true, color: { argb: 'FF808080' } };
      }

      // Hoja de instrucciones
      const sheetInstrucciones = workbook.addWorksheet('Instrucciones');
      sheetInstrucciones.columns = [{ header: 'Instrucciones de Uso', width: 85 }];
      sheetInstrucciones.addRow(['']);
      sheetInstrucciones.addRow(['📋 CÓMO USAR ESTE TEMPLATE']);
      sheetInstrucciones.addRow(['']);
      sheetInstrucciones.addRow(['1. HOJA "Productos": Ingrese los datos básicos del producto']);
      sheetInstrucciones.addRow(['   - modelo: Nombre del producto (ej: GABANNA, CORCHETE GRANDE)']);
      sheetInstrucciones.addRow(['   - categoria: TELAS, CORCHETES, PATAS, BOTONES, RELLENOS, etc.']);
      sheetInstrucciones.addRow(['   - tipo: Subtipo del producto (ej: LINO, FELPA, METALICO)']);
      sheetInstrucciones.addRow(['   - unidad_medida: metro, unidad, kilogramo, litros']);
      sheetInstrucciones.addRow(['']);
      sheetInstrucciones.addRow(['2. HOJA "Variantes_Precios": Una fila por cada MODALIDAD']);
      sheetInstrucciones.addRow(['   - modelo: Debe coincidir EXACTAMENTE con la hoja Productos']);
      sheetInstrucciones.addRow(['   - color: Color de la variante (puede estar vacío)']);
      sheetInstrucciones.addRow(['   - medida: Ancho o medida del producto']);
      sheetInstrucciones.addRow(['   - material: Composición del material']);
      sheetInstrucciones.addRow(['   - modalidad: METRO, ROLLO, UNIDAD, CAJA, EMBALAJE, KILO, DOCENA, etc.']);
      sheetInstrucciones.addRow(['   - precio_neto: Precio sin IVA']);
      sheetInstrucciones.addRow(['   - cantidad_base: Cantidad que incluye (ej: 25 metros por rollo, 10 por caja)']);
      sheetInstrucciones.addRow(['   - es_variable: SI si permite decimales (ej: 1.5 metros), NO si es cantidad fija']);
      sheetInstrucciones.addRow(['   - minimo_cant: Cantidad mínima de venta (ej: 0.5 para medio metro)']);
      sheetInstrucciones.addRow(['']);
      sheetInstrucciones.addRow(['📌 EJEMPLOS:']);
      sheetInstrucciones.addRow(['   - TELA: Crear filas con modalidad METRO y ROLLO']);
      sheetInstrucciones.addRow(['   - CORCHETE: Crear filas con modalidad UNIDAD, CAJA y/o EMBALAJE']);
      sheetInstrucciones.addRow(['   - RELLENO: Crear fila con modalidad KILO']);
      sheetInstrucciones.addRow(['']);
      sheetInstrucciones.addRow(['⚠️ NOTAS IMPORTANTES:']);
      sheetInstrucciones.addRow(['   - El CÓDIGO del producto se genera automáticamente']);
      sheetInstrucciones.addRow(['   - Las filas de ejemplo (grises) deben ser eliminadas']);
      sheetInstrucciones.addRow(['   - Variantes con mismo modelo+color+medida+material se agrupan automáticamente']);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=template_productos.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    // Exportación con datos existentes
    const whereProducto: any = { activo: true };
    if (categoria) whereProducto['$categoria.nombre$'] = categoria;
    if (tipo) whereProducto.tipo = tipo;

    const productos = await Producto.findAll({
      where: whereProducto,
      include: [
        { model: Categoria, as: 'categoria', attributes: ['nombre'] },
        {
          model: VarianteProducto, as: 'variantes', where: { activo: true }, required: false,
          include: [
            { model: ModalidadProducto, as: 'modalidades', where: { activa: true }, required: false },
            { model: StockPorBodega, as: 'stockPorBodega', required: false }
          ]
        }
      ],
      order: [['codigo', 'ASC']]
    });

    // Hoja 1: Productos
    const sheetProductos = workbook.addWorksheet('Productos');
    sheetProductos.columns = [
      { header: 'codigo', key: 'codigo', width: 18 },
      { header: 'modelo', key: 'modelo', width: 30 },
      { header: 'categoria', key: 'categoria', width: 15 },
      { header: 'tipo', key: 'tipo', width: 15 },
      { header: 'unidad_medida', key: 'unidad_medida', width: 15 }
    ];
    applyHeaderStyle(sheetProductos);

    // Hoja 2: Variantes con Modalidades (formato genérico)
    const sheetVariantes = workbook.addWorksheet('Variantes_Precios');
    sheetVariantes.columns = [
      { header: 'codigo_producto', key: 'codigo_producto', width: 18 },
      { header: 'modelo', key: 'modelo', width: 25 },
      { header: 'color', key: 'color', width: 15 },
      { header: 'medida', key: 'medida', width: 12 },
      { header: 'material', key: 'material', width: 18 },
      { header: 'modalidad', key: 'modalidad', width: 12 },
      { header: 'precio_neto', key: 'precio_neto', width: 12 },
      { header: 'cantidad_base', key: 'cantidad_base', width: 14 },
      { header: 'es_variable', key: 'es_variable', width: 12 },
      { header: 'minimo_cant', key: 'minimo_cant', width: 12 }
    ];
    applyHeaderStyle(sheetVariantes);

    productos.forEach((producto: any) => {
      // Agregar producto a Hoja 1
      sheetProductos.addRow({
        codigo: producto.codigo,
        modelo: producto.nombre,
        categoria: producto.categoria?.nombre,
        tipo: producto.tipo,
        unidad_medida: producto.unidad_medida
      });

      // Agregar una fila por cada modalidad de cada variante
      producto.variantes?.forEach((variante: any) => {
        variante.modalidades?.forEach((modalidad: any) => {
          sheetVariantes.addRow({
            codigo_producto: producto.codigo,
            modelo: producto.nombre,
            color: variante.color || '',
            medida: variante.medida || '',
            material: variante.material || '',
            modalidad: modalidad.nombre,
            precio_neto: modalidad.precio_neto,
            cantidad_base: modalidad.cantidad_base,
            es_variable: modalidad.es_cantidad_variable ? 'SI' : 'NO',
            minimo_cant: modalidad.minimo_cantidad
          });
        });
      });
    });

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=productos_${fecha}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

// ===========================
// 📥 IMPORTAR PRODUCTOS (Formato genérico por modalidades)
// ===========================
router.post('/importar', async (req: Request, res: Response, next: NextFunction) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });

  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ success: false, message: 'Error al subir archivo' });

    const transaction = await sequelize.transaction();
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      // Buscar hojas del formato
      const sheetProductos = workbook.getWorksheet('Productos');
      const sheetVariantes = workbook.getWorksheet('Variantes_Precios');

      if (!sheetProductos || !sheetVariantes) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El archivo debe tener las hojas "Productos" y "Variantes_Precios"'
        });
      }

      // Función para obtener valor de celda (maneja diferentes tipos)
      const getCellValue = (cell: any): string => {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object' && cell.value.text) return cell.value.text;
        if (typeof cell.value === 'object' && cell.value.result) return String(cell.value.result);
        return String(cell.value).trim();
      };

      const getCellNumber = (cell: any): number => {
        if (!cell || cell.value === null || cell.value === undefined) return 0;
        if (typeof cell.value === 'number') return cell.value;
        if (typeof cell.value === 'object' && cell.value.result) return Number(cell.value.result) || 0;
        return Number(cell.value) || 0;
      };

      // 1. Leer productos de Hoja 1
      const productosMap = new Map();
      let errores: string[] = [];

      sheetProductos.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // Skip header

        const modelo = getCellValue(row.getCell(1));
        const categoria = getCellValue(row.getCell(2));
        const tipo = getCellValue(row.getCell(3));
        const unidad_medida = getCellValue(row.getCell(4)) || 'metro';

        // Ignorar filas vacías o de ejemplo
        if (!modelo || !categoria) return;

        if (productosMap.has(modelo)) {
          errores.push(`Línea ${rowNumber}: Producto "${modelo}" duplicado`);
          return;
        }

        productosMap.set(modelo, {
          modelo,
          categoria,
          tipo,
          unidad_medida,
          variantes: new Map() // Map de varianteKey -> { color, medida, material, modalidades: [] }
        });
      });

      // 2. Leer variantes y modalidades de Hoja 2 (formato genérico)
      // Columnas: modelo | color | medida | material | modalidad | precio_neto | cantidad_base | es_variable | minimo_cant
      sheetVariantes.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // Skip header

        const modelo = getCellValue(row.getCell(1));
        const color = getCellValue(row.getCell(2));
        const medida = getCellValue(row.getCell(3));
        const material = getCellValue(row.getCell(4));
        const modalidad = getCellValue(row.getCell(5)).toUpperCase();
        const precio_neto = getCellNumber(row.getCell(6));
        const cantidad_base = getCellNumber(row.getCell(7)) || 1;
        const es_variable = getCellValue(row.getCell(8)).toUpperCase();
        const minimo_cant = getCellNumber(row.getCell(9)) || 1;

        // Ignorar filas vacías
        if (!modelo || !modalidad) return;

        // Verificar que el producto exista en Hoja 1
        if (!productosMap.has(modelo)) {
          errores.push(`Variantes línea ${rowNumber}: Producto "${modelo}" no existe en hoja Productos`);
          return;
        }

        // Validar precio
        if (precio_neto <= 0) {
          errores.push(`Línea ${rowNumber}: precio_neto debe ser mayor a 0`);
          return;
        }

        const producto = productosMap.get(modelo);
        const varianteKey = `${color}|${medida}|${material}`;

        // Crear variante si no existe
        if (!producto.variantes.has(varianteKey)) {
          producto.variantes.set(varianteKey, {
            color: color || null,
            medida: medida || null,
            material: material || null,
            modalidades: []
          });
        }

        // Agregar modalidad a la variante
        producto.variantes.get(varianteKey).modalidades.push({
          nombre: modalidad,
          precio_neto,
          cantidad_base,
          es_cantidad_variable: es_variable === 'SI',
          minimo_cantidad: minimo_cant
        });
      });

      // Validar que todos los productos tengan al menos una variante con modalidades
      for (const [modelo, data] of productosMap) {
        if (data.variantes.size === 0) {
          errores.push(`Producto "${modelo}" no tiene variantes definidas en hoja Variantes_Precios`);
        }
      }

      if (errores.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Errores en el archivo',
          errores: errores.slice(0, 15)
        });
      }

      // 3. Crear productos en la base de datos
      let importados = 0;
      let variantesCreadas = 0;
      let modalidadesCreadas = 0;

      for (const [modelo, productoData] of productosMap) {
        // Buscar o crear categoría
        let categoriaObj = await Categoria.findOne({
          where: { nombre: productoData.categoria },
          transaction
        });

        if (!categoriaObj) {
          categoriaObj = await Categoria.create({
            nombre: productoData.categoria,
            descripcion: `Categoría ${productoData.categoria}`,
            activa: true
          }, { transaction });
        }

        // Generar código automático
        const prefijo = productoData.categoria.substring(0, 3).toUpperCase();
        const tipoPrefix = productoData.tipo ? productoData.tipo.substring(0, 3).toUpperCase() : 'GEN';
        const modeloPrefix = modelo.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        let codigoFinal = `${prefijo}-${tipoPrefix}-${modeloPrefix}-${timestamp}`;

        // Verificar código único
        let contador = 1;
        while (await Producto.findOne({ where: { codigo: codigoFinal }, transaction })) {
          codigoFinal = `${prefijo}-${tipoPrefix}-${modeloPrefix}-${timestamp}-${contador}`;
          contador++;
        }

        // Crear producto
        const producto = await Producto.create({
          codigo: codigoFinal,
          nombre: modelo,
          id_categoria: categoriaObj.id_categoria,
          tipo: productoData.tipo || null,
          unidad_medida: productoData.unidad_medida,
          activo: true
        }, { transaction });

        importados++;

        // Crear variantes con sus modalidades
        for (const [, varianteData] of productoData.variantes) {
          // Generar SKU único
          let sku = `${codigoFinal}-${varianteData.color || 'STD'}`.substring(0, 50);
          let skuContador = 1;

          while (await VarianteProducto.findOne({ where: { sku }, transaction })) {
            sku = `${codigoFinal}-${varianteData.color || 'STD'}-${skuContador}`.substring(0, 50);
            skuContador++;
          }

          const variante = await VarianteProducto.create({
            id_producto: producto.id_producto,
            sku,
            color: varianteData.color,
            medida: varianteData.medida,
            material: varianteData.material,
            activo: true
          }, { transaction });

          variantesCreadas++;

          // Crear todas las modalidades de esta variante
          for (const modalidadData of varianteData.modalidades) {
            await ModalidadProducto.create({
              id_variante_producto: variante.id_variante_producto,
              nombre: modalidadData.nombre,
              descripcion: `Venta por ${modalidadData.nombre.toLowerCase()}`,
              cantidad_base: modalidadData.cantidad_base,
              es_cantidad_variable: modalidadData.es_cantidad_variable,
              minimo_cantidad: modalidadData.minimo_cantidad,
              precio_neto: modalidadData.precio_neto,
              precio_neto_factura: Math.round(modalidadData.precio_neto * 1.19),
              afecto_descuento_ticket: true,
              activa: true
            }, { transaction });

            modalidadesCreadas++;
          }
        }
      }

      await transaction.commit();
      res.status(201).json({
        success: true,
        data: {
          productos_creados: importados,
          variantes_creadas: variantesCreadas,
          modalidades_creadas: modalidadesCreadas
        },
        message: `Importación exitosa: ${importados} productos, ${variantesCreadas} variantes y ${modalidadesCreadas} modalidades`
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  });
});

export default router;