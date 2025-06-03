// routes/vendedor.routes.ts - VERSIÓN CORREGIDA CON NUMERACIÓN DIARIA
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { Categoria } from '../models/Categoria.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Bodega } from '../models/Bodega.model';
import { Op } from 'sequelize';
import { Usuario } from '../models/Usuario.model';
import { Pedido } from '../models/Pedido.model';
import { DetallePedido } from '../models/DetallePedido.model';
import { sequelize } from '../config/database';
import { QueryTypes } from 'sequelize';

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
 */
router.get('/productos', async (req, res, next) => {
  try {
    const { categoria, tipo, search, con_stock = 'true', bodega_id } = req.query;
    
    // Filtros
    const whereProducto: any = { activo: true };
    const whereStock: any = {};
    
    if (categoria) {
      const catId = Number(categoria);
      if (!isNaN(catId)) {
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

    // ✅ CONSULTA OPTIMIZADA: Modalidades desde variantes
    const productos = await Producto.findAll({
      where: whereProducto,
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['id_categoria', 'nombre']
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [
            {
              model: ModalidadProducto,
              as: 'modalidades',
              where: { activa: true },
              required: false,
              attributes: [
                'id_modalidad', 'nombre', 'descripcion', 'cantidad_base',
                'es_cantidad_variable', 'minimo_cantidad', 'precio_neto',
                'precio_neto_factura', 'precio_costo'
              ]
            },
            {
              model: StockPorBodega,
              as: 'stockPorBodega',
              where: whereStock,
              required: con_stock === 'true',
              include: [{
                model: Bodega,
                as: 'bodega',
                attributes: ['id_bodega', 'nombre', 'codigo']
              }]
            }
          ]
        }
      ],
      order: [
        [{ model: Categoria, as: 'categoria' }, 'nombre', 'ASC'],
        ['tipo', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    // ✅ PROCESAMIENTO MEJORADO: Obtener modalidades desde variantes
    const productosVendedor = productos.map(producto => {
      // Calcular stock total de todas las variantes
      const stockTotal = producto.variantes?.reduce((total: number, variante: any) => {
        const stockVariante = variante.stockPorBodega?.reduce((subTotal: number, stock: any) => 
          subTotal + Number(stock.cantidad_disponible), 0
        ) || 0;
        return total + stockVariante;
      }, 0) || 0;

      // ✅ OBTENER MODALIDADES DESDE VARIANTES
      const todasModalidades: any[] = [];
      producto.variantes?.forEach(variante => {
        if (variante.modalidades) {
          todasModalidades.push(...variante.modalidades);
        }
      });

      let precioMinimo = 0;
      let precioMaximo = 0;

      if (todasModalidades.length > 0) {
        const precios = todasModalidades.map((m: any) => Number(m.precio_neto));
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
        modalidades_disponibles: getModalidadesUnicas(todasModalidades),
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
          ) || 0,
          modalidades: (variante.modalidades || []).map((modalidad: any) => ({
            id_modalidad: modalidad.id_modalidad,
            nombre: modalidad.nombre,
            descripcion: modalidad.descripcion || '',
            precio_neto: modalidad.precio_neto,
            precio_con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19),
            es_variable: modalidad.es_cantidad_variable,
            minimo: modalidad.minimo_cantidad
          }))
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

// ✅ FUNCIÓN HELPER PARA OBTENER MODALIDADES ÚNICAS
function getModalidadesUnicas(modalidades: any[]): any[] {
  const modalidadesMap = new Map();
  
  modalidades.forEach(modalidad => {
    const key = modalidad.nombre;
    if (!modalidadesMap.has(key)) {
      modalidadesMap.set(key, {
        nombre: modalidad.nombre,
        descripcion: modalidad.descripcion || '',
        precio_neto: modalidad.precio_neto,
        precio_con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19),
        es_variable: modalidad.es_cantidad_variable,
        minimo: modalidad.minimo_cantidad
      });
    }
  });
  
  return Array.from(modalidadesMap.values());
}

/**
 * @openapi
 * /vendedor/producto/{id}:
 *   get:
 *     summary: Obtener detalles completos de un producto para venta
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
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [
            {
              model: ModalidadProducto,
              as: 'modalidades',
              where: { activa: true },
              required: false
            },
            {
              model: StockPorBodega,
              as: 'stockPorBodega',
              where: whereStock,
              required: false,
              include: [{
                model: Bodega,
                as: 'bodega',
                attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta']
              }]
            }
          ]
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

    // ✅ OBTENER MODALIDADES DESDE VARIANTES
    const todasModalidades: any[] = [];
    producto.variantes?.forEach(variante => {
      if (variante.modalidades) {
        todasModalidades.push(...variante.modalidades);
      }
    });

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
      modalidades: getModalidadesUnicas(todasModalidades).map((modalidad: any) => ({
        nombre: modalidad.nombre,
        descripcion: modalidad.descripcion,
        precios: {
          neto: modalidad.precio_neto,
          con_iva: modalidad.precio_con_iva
        },
        es_cantidad_variable: modalidad.es_variable,
        minimo_cantidad: modalidad.minimo
      })),
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
          modalidades: (variante.modalidades || []).map((modalidad: any) => ({
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
          })),
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
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [
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
              model: StockPorBodega,
              as: 'stockPorBodega',
              where: whereStock,
              required: solo_con_stock === 'true'
            }
          ]
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

      // ✅ OBTENER PRECIO MÍNIMO DESDE MODALIDADES DE VARIANTES
      let precioMinimo = Infinity;
      producto.variantes?.forEach((variante: any) => {
        variante.modalidades?.forEach((modalidad: any) => {
          if (modalidad.precio_neto < precioMinimo) {
            precioMinimo = modalidad.precio_neto;
          }
        });
      });

      return {
        id_producto: producto.id_producto,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria?.nombre,
        tipo: producto.tipo,
        descripcion_completa: `${producto.tipo || ''} ${producto.nombre}`.trim(),
        stock_total: stockTotal,
        tiene_stock: stockTotal > 0,
        precio_desde: precioMinimo === Infinity ? 0 : precioMinimo,
        precio_formateado: `$${(precioMinimo === Infinity ? 0 : precioMinimo).toLocaleString('es-CL')}`
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

/**
 * @openapi
 * /vendedor/pedido-rapido:
 *   post:
 *     summary: Crear pedido rápido (vale) con numeración diaria
 */
router.post('/pedido-rapido', async (req, res, next) => {
  const { tipo_documento, detalles } = req.body;

  try {
    // ✅ 1) VALIDACIONES BÁSICAS FUERA DE LA TRANSACCIÓN
    if (!tipo_documento || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento y lista de detalles son requeridos.'
      });
    }

    if (!['ticket', 'boleta', 'factura'].includes(tipo_documento)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento inválido. Debe ser: ticket, boleta o factura.'
      });
    }

    // Validar cada detalle
    let subtotalTotal = 0;
    for (let i = 0; i < detalles.length; i++) {
      const det = detalles[i];

      if (
        typeof det.id_variante_producto !== 'number' ||
        typeof det.id_modalidad !== 'number' ||
        typeof det.cantidad !== 'number' ||
        typeof det.precio_unitario !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Todos los campos (id_variante_producto, id_modalidad, cantidad, precio_unitario) deben ser números válidos.`
        });
      }

      if (det.cantidad <= 0 || det.precio_unitario <= 0) {
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Cantidad y precio unitario deben ser mayores a 0.`
        });
      }

      // Verificar que la variante existe y está activa
      const variante = await VarianteProducto.findByPk(det.id_variante_producto, {
        include: [{ model: Producto, as: 'producto', attributes: ['activo', 'nombre'] }]
      });
      if (!variante || !variante.activo || !variante.producto || !variante.producto.activo) {
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Variante ${det.id_variante_producto} o su producto asociado no existe o está inactivo.`
        });
      }

      // Verificar que la modalidad existe, está activa y pertenece a la variante
      const modalidad = await ModalidadProducto.findOne({
        where: {
          id_modalidad: det.id_modalidad,
          id_variante_producto: det.id_variante_producto,
          activa: true
        }
      });
      if (!modalidad) {
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Modalidad ${det.id_modalidad} no existe, no pertenece a la variante ${det.id_variante_producto} o está inactiva.`
        });
      }

      subtotalTotal += det.cantidad * det.precio_unitario;
    }

    // ✅ 2) INICIAR TRANSACCIÓN PARA ESCRITURAS
    const transaction = await sequelize.transaction();
    try {
      // ✅ USAR PROCEDIMIENTOS ALMACENADOS PARA GENERAR NÚMEROS
      const [resultado]: any = await sequelize.query(
        'SELECT generar_numero_pedido_simple() as numero_completo, obtener_proximo_numero_diario() as numero_diario',
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      const numeroCompleto = resultado.numero_completo;
      const numeroDiario = resultado.numero_diario;

      console.log('🎯 Números generados por procedimientos:', { numeroCompleto, numeroDiario });

      // ✅ 3) CREAR EL PEDIDO PRINCIPAL
      const nuevoPedido = await Pedido.create(
        {
          numero_pedido: numeroCompleto,
          numero_diario: numeroDiario,
          id_vendedor: req.user!.id,
          tipo_documento,
          estado: 'vale_pendiente',
          subtotal: subtotalTotal,
          total: subtotalTotal,
          datos_completos: tipo_documento !== 'factura',
          observaciones: `Vale #${numeroDiario} creado por ${req.user!.username}`,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date()
        },
        { transaction }
      );

      // ✅ 4) INSERTAR DETALLES
      const detallesParaInsertar = detalles.map((det) => ({
        id_pedido: nuevoPedido.id_pedido,
        id_variante_producto: det.id_variante_producto,
        id_modalidad: det.id_modalidad,
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: Math.round(det.cantidad * det.precio_unitario),
        observaciones: det.observaciones || '',
        fecha_creacion: new Date()
      }));

      await DetallePedido.bulkCreate(detallesParaInsertar, { transaction });

      // ✅ 5) COMMIT
      await transaction.commit();

      // ✅ 6) RESPUESTA CON DATOS PARA EL MODAL
      return res.status(201).json({
        success: true,
        data: {
          id_pedido: nuevoPedido.id_pedido,
          numero_pedido: nuevoPedido.numero_pedido,
          numero_diario: nuevoPedido.numero_diario,
          estado: nuevoPedido.estado,
          tipo_documento: nuevoPedido.tipo_documento,
          subtotal: nuevoPedido.subtotal,
          total: nuevoPedido.total,
          fecha_creacion: nuevoPedido.fecha_creacion,
          detalles_count: detallesParaInsertar.length
        },
        message: `Vale #${nuevoPedido.numero_diario} creado exitosamente.`
      });

    } catch (errTransaction) {
      await transaction.rollback();
      console.error('❌ Error en transacción:', errTransaction);
      return res.status(500).json({
        success: false,
        message: 'No se pudo guardar el pedido. Intente nuevamente.'
      });
    }

  } catch (errValidaciones) {
    console.error('❌ Error en validaciones:', errValidaciones);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al procesar el pedido.' 
    });
  }
});

/**
 * @openapi
 * /vendedor/estadisticas-dia:
 *   get:
 *     summary: Obtener estadísticas del día para el vendedor
 */
router.get('/estadisticas-dia', async (req, res, next) => {
  try {
    const { fecha } = req.query;
    const fechaConsulta = fecha ? new Date(fecha as string) : new Date();
    
    // ✅ CONSULTA OPTIMIZADA PARA ESTADÍSTICAS DEL DÍA
    const [estadisticas]: any = await sequelize.query(
      `SELECT 
        DATE(fecha_creacion) as fecha,
        COUNT(*) as total_vales,
        MAX(numero_diario) as ultimo_numero,
        MIN(numero_diario) as primer_numero,
        SUM(total) as monto_total,
        COUNT(CASE WHEN estado = 'vale_pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado = 'completado' THEN 1 END) as completados
      FROM pedidos 
      WHERE DATE(fecha_creacion) = DATE(?)
      GROUP BY DATE(fecha_creacion)`,
      {
        replacements: [fechaConsulta],
        type: QueryTypes.SELECT
      }
    );

    const resultado = estadisticas || {
      fecha: fechaConsulta.toISOString().split('T')[0],
      total_vales: 0,
      ultimo_numero: 0,
      primer_numero: 0,
      monto_total: 0,
      pendientes: 0,
      completados: 0
    };

    res.json({
      success: true,
      data: {
        ...resultado,
        fecha_formateada: fechaConsulta.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      }
    });

  } catch (error) {
    console.error('❌ Error en estadísticas del día:', error);
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/pedido-rapido:
 *   post:
 *     summary: Crear un vale/pedido rápido para procesar en caja
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo_documento:
 *                 type: string
 *                 enum: [ticket, boleta, factura]
 *               detalles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id_variante_producto:
 *                       type: integer
 *                     id_modalidad:
 *                       type: integer
 *                     cantidad:
 *                       type: number
 *                     precio_unitario:
 *                       type: number
 *                     observaciones:
 *                       type: string
 *     responses:
 *       '201':
 *         description: Vale creado exitosamente
 */
router.post('/pedido-rapido', async (req, res, next) => {
  const sequelize = Usuario.sequelize;
  let transaction;
  
  try {
    transaction = await sequelize!.transaction();
    
    const { tipo_documento, detalles } = req.body;
    const vendedorId = req.user?.id;

    console.log('📝 Creando pedido rápido:', { 
      tipo_documento, 
      detalles: detalles?.length, 
      vendedor: req.user?.username 
    });

    // Validaciones básicas
    if (!tipo_documento || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento y detalles son requeridos'
      });
    }

    if (!['ticket', 'boleta', 'factura'].includes(tipo_documento)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento inválido'
      });
    }

    // Validar estructura de cada detalle
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      
      if (!detalle.id_variante_producto || !detalle.id_modalidad || 
          !detalle.cantidad || !detalle.precio_unitario) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Todos los campos son requeridos`
        });
      }

      if (detalle.cantidad <= 0 || detalle.precio_unitario <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Cantidad y precio deben ser mayores a 0`
        });
      }
    }

    // Generar número de pedido único
    const fechaHoy = new Date();
    const year = fechaHoy.getFullYear().toString().slice(-2);
    const month = (fechaHoy.getMonth() + 1).toString().padStart(2, '0');
    const day = fechaHoy.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const numeroPedido = `VP${year}${month}${day}${random}`;

    console.log('🏷️ Número de pedido generado:', numeroPedido);

    // Validar que todas las variantes y modalidades existan
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      
      const variante = await VarianteProducto.findByPk(detalle.id_variante_producto, {
        include: [{
          model: Producto,
          as: 'producto',
          attributes: ['nombre', 'codigo', 'activo']
        }],
        transaction
      });

      if (!variante || !variante.activo) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Variante no encontrada o inactiva`
        });
      }

      const modalidad = await ModalidadProducto.findOne({
        where: {
          id_modalidad: detalle.id_modalidad,
          id_variante_producto: detalle.id_variante_producto,
          activa: true
        },
        transaction
      });

      if (!modalidad) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Detalle ${i + 1}: Modalidad no encontrada para esta variante`
        });
      }

      console.log(`✅ Validado detalle ${i + 1}: ${variante.producto?.nombre} - ${modalidad.nombre}`);
    }

    // Calcular totales
    const subtotal = detalles.reduce((sum, detalle) => 
      sum + (Number(detalle.cantidad) * Number(detalle.precio_unitario)), 0
    );

    console.log('💰 Subtotal calculado:', subtotal);

    // Crear pedido principal
    const nuevoPedido = await Pedido.create({
      numero_pedido: numeroPedido,
      id_vendedor: vendedorId,
      tipo_documento,
      estado: 'vale_pendiente',
      subtotal: subtotal,
      total: subtotal,
      datos_completos: tipo_documento !== 'factura',
      observaciones: `Vale creado por vendedor ${req.user?.username} desde dashboard`,
      fecha_creacion: new Date(),
      fecha_actualizacion: new Date()
    }, { transaction });

    console.log('📄 Pedido creado:', nuevoPedido.id_pedido, nuevoPedido.numero_pedido);

    // Crear detalles del pedido
    const detallesCreados = [];
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      
      const detalleCreado = await DetallePedido.crearDetalle({
        id_pedido: nuevoPedido.id_pedido,
        id_variante_producto: detalle.id_variante_producto,
        id_modalidad: detalle.id_modalidad,
        cantidad: Number(detalle.cantidad),
        precio_unitario: Number(detalle.precio_unitario),
        tipo_precio: 'neto',
        observaciones: detalle.observaciones || ''
      });

      detallesCreados.push(detalleCreado);
      console.log(`📦 Detalle ${i + 1} creado:`, detalleCreado.id_detalle);
    }

    // Confirmar transacción
    await transaction.commit();
    console.log('✅ Transacción confirmada - Vale creado exitosamente');

    // Respuesta al frontend
    res.status(201).json({
      success: true,
      data: {
        id_pedido: nuevoPedido.id_pedido,
        numero_pedido: nuevoPedido.numero_pedido,
        estado: nuevoPedido.estado,
        tipo_documento: nuevoPedido.tipo_documento,
        subtotal: nuevoPedido.subtotal,
        total: nuevoPedido.total,
        fecha_creacion: nuevoPedido.fecha_creacion,
        detalles_count: detallesCreados.length,
        vendedor: req.user?.username
      },
      message: `Vale ${nuevoPedido.numero_pedido} creado exitosamente`
    });

    console.log(`🎯 VALE CREADO: ${numeroPedido} por ${req.user?.username}`);

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('❌ Error creando pedido rápido:', error);
    
    if ((error as any).name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Error: Número de pedido duplicado. Intente nuevamente.'
      });
    }

    if ((error as any).name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Error: Referencia inválida en los datos del pedido.'
      });
    }
    
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/mis-vales:
 *   get:
 *     summary: Listar vales/pedidos creados por el vendedor
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 */
router.get('/mis-vales', async (req, res, next) => {
  try {
    const { estado, fecha_desde, limit = 20 } = req.query;
    const vendedorId = req.user?.id;

    const whereConditions: any = {
      id_vendedor: vendedorId,
      estado: { [Op.in]: ['vale_pendiente', 'procesando_caja', 'completado', 'cancelado'] }
    };

    if (estado) {
      whereConditions.estado = estado;
    }

    if (fecha_desde) {
      whereConditions.fecha_creacion = {
        [Op.gte]: new Date(fecha_desde as string)
      };
    }

    const pedidos = await Pedido.findAll({
      where: whereConditions,
      include: [{
        model: DetallePedido,
        as: 'detalles',
        include: [{
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto',
            attributes: ['nombre', 'codigo']
          }]
        }]
      }],
      order: [['fecha_creacion', 'DESC']],
      limit: Number(limit)
    });

    const valesFormateados = pedidos.map(pedido => ({
      id_pedido: pedido.id_pedido,
      numero_pedido: pedido.numero_pedido,
      estado: pedido.estado,
      estado_descripcion: (pedido as any).getEstadoDescripcion(),
      tipo_documento: pedido.tipo_documento,
      total: pedido.total,
      fecha_creacion: pedido.fecha_creacion,
      total_productos: pedido.detalles?.length || 0
    }));

    res.json({
      success: true,
      data: valesFormateados,
      total: valesFormateados.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo vales del vendedor:', error);
    next(error);
  }
});

/**
 * @openapi
 * /vendedor/vale/{numero_pedido}:
 *   get:
 *     summary: Obtener detalles completos de un vale específico
 *     tags:
 *       - vendedor
 *     security:
 *       - bearerAuth: []
 */
router.get('/vale/:numero_pedido', async (req, res, next) => {
  try {
    const { numero_pedido } = req.params;
    const vendedorId = req.user?.id;

    const pedido = await Pedido.findOne({
      where: {
        numero_pedido,
        id_vendedor: vendedorId
      },
      include: [{
        model: DetallePedido,
        as: 'detalles',
        include: [{
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto'
          }]
        }, {
          model: ModalidadProducto,
          as: 'modalidad'
        }]
      }, {
        model: Usuario,
        as: 'vendedor',
        attributes: ['usuario', 'nombre_completo']
      }]
    });

    if (!pedido) {
      return res.status(404).json({
        success: false,
        message: 'Vale no encontrado'
      });
    }

    const valeDetallado = {
      id_pedido: pedido.id_pedido,
      numero_pedido: pedido.numero_pedido,
      estado: pedido.estado,
      tipo_documento: pedido.tipo_documento,
      subtotal: pedido.subtotal,
      total: pedido.total,
      fecha_creacion: pedido.fecha_creacion,
      observaciones: pedido.observaciones,
      vendedor: {
        usuario: (pedido.vendedor as any)?.usuario,
        nombre: (pedido.vendedor as any)?.nombre_completo || 'Vendedor'
      },
      detalles: pedido.detalles?.map(detalle => ({
        id_detalle: detalle.id_detalle,
        producto: {
          nombre: detalle.varianteProducto?.producto?.nombre,
          codigo: detalle.varianteProducto?.producto?.codigo
        },
        variante: {
          sku: detalle.varianteProducto?.sku,
          color: detalle.varianteProducto?.color,
          medida: detalle.varianteProducto?.medida,
          material: detalle.varianteProducto?.material
        },
        modalidad: {
          nombre: detalle.modalidad?.nombre,
          descripcion: detalle.modalidad?.descripcion
        },
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal,
        observaciones: detalle.observaciones
      })) || []
    };

    res.json({
      success: true,
      data: valeDetallado
    });

  } catch (error) {
    console.error('❌ Error obteniendo vale:', error);
    next(error);
  }
});
export default router;