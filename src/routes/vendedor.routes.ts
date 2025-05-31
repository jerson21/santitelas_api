// src/routes/vendedor.routes.ts - VERSIÓN CORREGIDA CON TIPOS
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { Categoria } from '../models/Categoria.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Bodega } from '../models/Bodega.model';
import { Op } from 'sequelize';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /vendedor/productos:
 *   get:
 *     summary: Listar productos disponibles para venta
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtrar por categoría
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtrar por tipo de producto
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda por nombre o código
 *       - in: query
 *         name: con_stock
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Solo productos con stock
 *       - in: query
 *         name: bodega_id
 *         schema:
 *           type: integer
 *         description: Stock en bodega específica
 *     responses:
 *       '200':
 *         description: Lista de productos para venta
 */
router.get('/productos', async (req, res, next) => {
  try {
    const { categoria, tipo, search, con_stock = 'true', bodega_id } = req.query;
    
    // Filtros
    const whereProducto: any = { activo: true };
    const whereStock: any = {};
    
    if (categoria) {
      // Filtrar por categoría usando el ID en lugar del nombre
      const catId = Number(categoria);
      if (!isNaN(catId)) {
        // campo directo de producto: id_categoria
        whereProducto.id_categoria = catId;
      }
    }
    if (tipo) {
      whereProducto.tipo = tipo;
    }
    if (search) {
      whereProducto[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { codigo: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (bodega_id) {
      whereStock.id_bodega = bodega_id;
    }
    if (con_stock === 'true') {
      whereStock.cantidad_disponible = { [Op.gt]: 0 };
    }

    // Consulta principal
    const productos = await Producto.findAll({
      where: whereProducto,
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['id_categoria', 'nombre']
        },
        {
          model: ModalidadProducto,
          as: 'modalidades',
          where: { activa: true },
          required: false,
          attributes: [
            'id_modalidad', 'nombre', 'descripcion', 'cantidad_base',
            'es_cantidad_variable', 'minimo_cantidad', 'precio_neto',
            'precio_neto_factura'
          ]
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: StockPorBodega,
            as: 'stockPorBodega',
            where: whereStock,
            required: con_stock === 'true',
            include: [{
              model: Bodega,
              as: 'bodega',
              attributes: ['id_bodega', 'nombre', 'codigo']
            }]
          }]
        }
      ],
      order: [
        [{ model: Categoria, as: 'categoria' }, 'nombre', 'ASC'],
        ['tipo', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    // ✅ PROCESAMIENTO CON TIPOS EXPLÍCITOS
    const productosVendedor = productos.map(producto => {
      // Calcular stock total de todas las variantes
      const stockTotal = producto.variantes?.reduce((total: number, variante: any) => {
        const stockVariante = variante.stockPorBodega?.reduce((subTotal: number, stock: any) => 
          subTotal + Number(stock.cantidad_disponible), 0
        ) || 0;
        return total + stockVariante;
      }, 0) || 0;

      // ✅ OBTENER MODALIDADES CON TIPO EXPLÍCITO
      const modalidades = producto.modalidades || [];
      let precioMinimo = 0;
      let precioMaximo = 0;

      if (modalidades.length > 0) {
        const precios = modalidades.map((m: any) => Number(m.precio_neto)); // ✅ TIPO EXPLÍCITO
        precioMinimo = Math.min(...precios);
        precioMaximo = Math.max(...precios);
      }

      // Filtrar variantes con stock si es necesario
      const variantesConStock = producto.variantes?.filter(variante => {
        if (con_stock !== 'true') return true;
        const stockVariante = variante.stockPorBodega?.reduce((sum: number, stock: any) => 
          sum + Number(stock.cantidad_disponible), 0
        ) || 0;
        return stockVariante > 0;
      }) || [];

      return {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria?.nombre || 'SIN CATEGORÍA',
        tipo: producto.tipo || 'SIN TIPO',
        descripcion: producto.descripcion || '',
        descripcion_completa: `${producto.tipo || ''} ${producto.nombre}`.trim(),
        stock_total: stockTotal,
        tiene_stock: stockTotal > 0,
        precios: {
          desde: precioMinimo,
          hasta: precioMaximo,
          rango: precioMinimo === precioMaximo 
            ? `$${precioMinimo.toLocaleString('es-CL')}`
            : `$${precioMinimo.toLocaleString('es-CL')} - $${precioMaximo.toLocaleString('es-CL')}`
        },
        total_variantes: variantesConStock.length,
        // ✅ MODALIDADES CON TIPO EXPLÍCITO
        modalidades_disponibles: modalidades.map((modalidad: any) => ({
          id_modalidad: modalidad.id_modalidad,
          nombre: modalidad.nombre,
          descripcion: modalidad.descripcion || '',
          precio_neto: modalidad.precio_neto,
          precio_con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19),
          es_variable: modalidad.es_cantidad_variable,
          minimo: modalidad.minimo_cantidad
        })),
        variantes: variantesConStock.map(variante => ({
          id_variante: variante.id_variante_producto,
          sku: variante.sku,
          color: variante.color,
          medida: variante.medida,
          material: variante.material,
          descripcion: [variante.color, variante.medida, variante.material]
            .filter(Boolean).join(' - ') || 'Estándar',
          stock_disponible: variante.stockPorBodega?.reduce((sum: number, stock: any) => 
            sum + Number(stock.cantidad_disponible), 0
          ) || 0
        }))
      };
    });

    // Filtrar productos sin stock si es necesario
    const resultados = con_stock === 'true' 
      ? productosVendedor.filter(p => p.tiene_stock)
      : productosVendedor;

    res.json({
      success: true,
      data: resultados,
      total: resultados.length,
      filtros_aplicados: {
        categoria,
        tipo,
        search,
        con_stock,
        bodega_id
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /vendedor/productos:', error);
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/producto/{id}:
 *   get:
 *     summary: Obtener detalles completos de un producto para venta
 *     tags:
 *       - vendedor
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
 *         description: Detalles completos del producto
 *       '404':
 *         description: Producto no encontrado
 */
router.get('/producto/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bodega_id } = req.query;

    const whereStock: any = {};
    if (bodega_id) {
      whereStock.id_bodega = bodega_id;
    }

    const producto = await Producto.findByPk(id, {
      include: [
        {
          model: Categoria,
          as: 'categoria'
        },
        {
          model: ModalidadProducto,
          as: 'modalidades',
          where: { activa: true },
          required: false
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: StockPorBodega,
            as: 'stockPorBodega',
            where: whereStock,
            required: false,
            include: [{
              model: Bodega,
              as: 'bodega',
              attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta']
            }]
          }]
        }
      ]
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Calcular información para el vendedor
    const stockTotal = producto.variantes?.reduce((total: number, variante: any) => {
      const stockVariante = variante.stockPorBodega?.reduce((subTotal: number, stock: any) => 
        subTotal + Number(stock.cantidad_disponible), 0
      ) || 0;
      return total + stockVariante;
    }, 0) || 0;

    const productoDetalle = {
      id_producto: producto.id_producto,
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      categoria: producto.categoria?.nombre || 'SIN CATEGORÍA',
      tipo: producto.tipo || 'SIN TIPO',
      unidad_medida: producto.unidad_medida,
      stock_total: stockTotal,
      tiene_stock: stockTotal > 0,
      stock_minimo: producto.stock_minimo_total,
      // ✅ MODALIDADES CON TIPO EXPLÍCITO
      modalidades: producto.modalidades?.map((modalidad: any) => ({
        id_modalidad: modalidad.id_modalidad,
        nombre: modalidad.nombre,
        descripcion: modalidad.descripcion,
        cantidad_base: modalidad.cantidad_base,
        es_cantidad_variable: modalidad.es_cantidad_variable,
        minimo_cantidad: modalidad.minimo_cantidad,
        precios: {
          neto: modalidad.precio_neto,
          factura: modalidad.precio_neto_factura,
          con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19)
        }
      })) || [],
      variantes: producto.variantes?.map(variante => {
        const stockVariante = variante.stockPorBodega?.reduce((sum: number, stock: any) => 
          sum + Number(stock.cantidad_disponible), 0
        ) || 0;

        return {
          id_variante: variante.id_variante_producto,
          sku: variante.sku,
          color: variante.color,
          medida: variante.medida,
          material: variante.material,
          descripcion: [variante.color, variante.medida, variante.material]
            .filter(Boolean).join(' - ') || 'Estándar',
          stock_disponible: stockVariante,
          tiene_stock: stockVariante > 0,
          stock_por_bodega: variante.stockPorBodega?.map((stock: any) => ({
            bodega: stock.bodega?.nombre,
            codigo_bodega: stock.bodega?.codigo,
            es_punto_venta: stock.bodega?.es_punto_venta,
            cantidad_disponible: stock.cantidad_disponible,
            cantidad_reservada: stock.cantidad_reservada
          })) || []
        };
      }) || []
    };

    res.json({
      success: true,
      data: productoDetalle
    });

  } catch (error) {
    console.error('❌ Error en GET /vendedor/producto/:id:', error);
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/buscar:
 *   get:
 *     summary: Búsqueda rápida de productos para vendedor
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Término de búsqueda (código, nombre, SKU)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: solo_con_stock
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       '200':
 *         description: Resultados de búsqueda rápida
 */
router.get('/buscar', async (req, res, next) => {
  try {
    const { q, limit = 10, solo_con_stock = 'true' } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const whereStock: any = {};
    if (solo_con_stock === 'true') {
      whereStock.cantidad_disponible = { [Op.gt]: 0 };
    }

    const productos = await Producto.findAll({
      where: {
        [Op.and]: [
          { activo: true },
          {
            [Op.or]: [
              { nombre: { [Op.iLike]: `%${q}%` } },
              { codigo: { [Op.iLike]: `%${q}%` } },
              { tipo: { [Op.iLike]: `%${q}%` } }
            ]
          }
        ]
      },
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: ModalidadProducto,
          as: 'modalidades',
          where: { activa: true },
          required: false,
          attributes: ['precio_neto'],
          limit: 1,
          order: [['precio_neto', 'ASC']]
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: StockPorBodega,
            as: 'stockPorBodega',
            where: whereStock,
            required: solo_con_stock === 'true'
          }]
        }
      ],
      limit: Number(limit),
      order: [['nombre', 'ASC']]
    });

    const resultados = productos.map(producto => {
      const stockTotal = producto.variantes?.reduce((total: number, variante: any) => {
        const stockVariante = variante.stockPorBodega?.reduce((subTotal: number, stock: any) => 
          subTotal + Number(stock.cantidad_disponible), 0
        ) || 0;
        return total + stockVariante;
      }, 0) || 0;

      // ✅ MODALIDADES CON TIPO EXPLÍCITO
      const precioMinimo = producto.modalidades?.[0]?.precio_neto || 0;

      return {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria?.nombre,
        tipo: producto.tipo,
        descripcion_completa: `${producto.tipo || ''} ${producto.nombre}`.trim(),
        stock_total: stockTotal,
        tiene_stock: stockTotal > 0,
        precio_desde: precioMinimo,
        precio_formateado: `$${precioMinimo.toLocaleString('es-CL')}`
      };
    });

    res.json({
      success: true,
      data: resultados,
      total: resultados.length
    });

  } catch (error) {
    console.error('❌ Error en GET /vendedor/buscar:', error);
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/stock/{productoId}:
 *   get:
 *     summary: Consultar stock detallado de un producto
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Stock detallado del producto
 *       '404':
 *         description: Producto no encontrado
 */
router.get('/stock/:productoId', async (req, res, next) => {
  try {
    const { productoId } = req.params;

    const producto = await Producto.findByPk(productoId, {
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: StockPorBodega,
            as: 'stockPorBodega',
            include: [{
              model: Bodega,
              as: 'bodega',
              where: { activa: true },
              attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta']
            }]
          }]
        }
      ]
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const stockTotal = producto.variantes?.reduce((total: number, variante: any) => {
      const stockVariante = variante.stockPorBodega?.reduce((subTotal: number, stock: any) => 
        subTotal + Number(stock.cantidad_disponible), 0
      ) || 0;
      return total + stockVariante;
    }, 0) || 0;

    const stockDetalle = {
      producto: {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria?.nombre,
        tipo: producto.tipo,
        stock_minimo: producto.stock_minimo_total
      },
      resumen: {
        stock_total: stockTotal,
        tiene_stock: stockTotal > 0,
        estado: stockTotal === 0 ? 'SIN_STOCK' : 
                stockTotal < producto.stock_minimo_total ? 'BAJO_MINIMO' : 'NORMAL'
      },
      por_variante: producto.variantes?.map(variante => {
        const stockVariante = variante.stockPorBodega?.reduce((sum: number, stock: any) => 
          sum + Number(stock.cantidad_disponible), 0
        ) || 0;

        return {
          id_variante: variante.id_variante_producto,
          sku: variante.sku,
          descripcion: [variante.color, variante.medida, variante.material]
            .filter(Boolean).join(' - ') || 'Estándar',
          stock_total: stockVariante,
          por_bodega: variante.stockPorBodega?.map((stock: any) => ({
            bodega_id: stock.bodega?.id_bodega,
            bodega_nombre: stock.bodega?.nombre,
            bodega_codigo: stock.bodega?.codigo,
            es_punto_venta: stock.bodega?.es_punto_venta,
            cantidad_disponible: stock.cantidad_disponible,
            cantidad_reservada: stock.cantidad_reservada,
            stock_total: Number(stock.cantidad_disponible) + Number(stock.cantidad_reservada)
          })) || []
        };
      }) || []
    };

    res.json({
      success: true,
      data: stockDetalle
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/categorias:
 *   get:
 *     summary: Listar categorías disponibles para filtros
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de categorías con contadores
 */
router.get('/categorias', async (req, res, next) => {
  try {
    const categorias = await Categoria.findAll({
      where: { activa: true },
      include: [{
        model: Producto,
        as: 'productos',
        where: { activo: true },
        required: false,
        attributes: ['id_producto', 'tipo']
      }],
      order: [['nombre', 'ASC']]
    });

    const categoriasConConteo = categorias.map(categoria => {
      const productos = categoria.productos || [];
      const tipos = [...new Set(productos.map((p: any) => p.tipo).filter(Boolean))];

      return {
        id_categoria: categoria.id_categoria,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        total_productos: productos.length,
        tipos_disponibles: tipos.sort()
      };
    });

    res.json({
      success: true,
      data: categoriasConConteo
    });

  } catch (error) {
    next(error);
  }
});

export default router;