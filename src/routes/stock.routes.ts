import { Router } from 'express';
import { Op } from 'sequelize';
import { auth } from '../middlewares/auth';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { MovimientoStock } from '../models/MovimientoStock.model';
import { Producto } from '../models/Producto.model';
import { Bodega } from '../models/Bodega.model';
import { Categoria } from '../models/Categoria.model';
import { Usuario } from '../models/Usuario.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { sequelize } from '../config/database';

const router = Router();
router.use(auth);

// Helper para estado del stock
function getStockStatus(cantidadDisponible: number, stockMinimo: number): string {
  if (cantidadDisponible === 0) return 'sin_stock';
  if (cantidadDisponible < stockMinimo) return 'bajo_minimo';
  if (cantidadDisponible <= stockMinimo * 1.5) return 'alerta';
  return 'normal';
}

// =======================================================
// GET /stock : Stock general
// =======================================================
router.get('/', async (req, res, next) => {
  try {
    const { bodega, categoria, bajo_minimo, sin_stock } = req.query;

    const whereClause: any = {};
    if (bodega) whereClause.id_bodega = bodega;
    if (sin_stock === 'true') whereClause.cantidad_disponible = 0;

    // Include con todos los alias correctos
    const includeVariante: any = {
      model: VarianteProducto,
      as: 'varianteProducto',
      required: true,
      include: [{
        model: Producto,
        as: 'producto',
        required: true,
        include: [{
          model: Categoria,
          as: 'categoria',
          attributes: ['id_categoria', 'nombre'],
          required: false
        }],
        where: { activo: true }
      }]
    };

    // Filtro por categoría
    if (categoria) {
      includeVariante.include[0].where.id_categoria = categoria;
    }

    const stockData = await StockPorBodega.findAll({
      where: whereClause,
      include: [
        includeVariante,
        {
          model: Bodega,
          as: 'bodega',
          attributes: ['id_bodega', 'nombre', 'codigo'],
          where: { activa: true },
          required: true
        }
      ],
      order: [['id_stock', 'DESC']]
    });

    let filteredData = stockData;

    // Filtro por productos bajo mínimo
    if (bajo_minimo === 'true') {
      filteredData = stockData.filter(stock =>
        stock.cantidad_disponible < (stock.varianteProducto?.producto?.stock_minimo_total ?? 0)
      );
    }

    // Agregar información de estado del stock
    const dataWithStatus = filteredData.map(stock => {
      const producto = stock.varianteProducto?.producto;
      return {
        ...stock.toJSON(),
        estado_stock: getStockStatus(stock.cantidad_disponible, producto?.stock_minimo_total ?? 0),
        stock_total: stock.cantidad_disponible + stock.cantidad_reservada,
        producto
      };
    });

    res.json({
      success: true,
      data: dataWithStatus,
      resumen: {
        total_registros: dataWithStatus.length,
        productos_sin_stock: dataWithStatus.filter(s => s.cantidad_disponible === 0).length,
        productos_bajo_minimo: dataWithStatus.filter(s => s.cantidad_disponible < (s.producto?.stock_minimo_total ?? 0) && s.cantidad_disponible > 0).length
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/producto/:productoId
// =======================================================
router.get('/producto/:productoId', async (req, res, next) => {
  try {
    const { productoId } = req.params;

    const producto = await Producto.findByPk(productoId, {
      include: [{
        model: Categoria,
        as: 'categoria',
        attributes: ['nombre']
      }]
    });
    if (!producto) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const variantes = await VarianteProducto.findAll({
      where: { id_producto: productoId }
    });
    const variantesIds = variantes.map(v => v.id_variante_producto);

    const stockPorBodega = await StockPorBodega.findAll({
      where: { id_variante_producto: variantesIds },
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto'
          }]
        },
        {
          model: Bodega,
          as: 'bodega',
          attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta'],
          where: { activa: true }
        }
      ],
      order: [['id_stock', 'DESC']]
    });

    const stockTotal = stockPorBodega.reduce((total, stock) =>
      total + (parseFloat(String(stock.cantidad_disponible)) || 0), 0
    );

    const stockReservadoTotal = stockPorBodega.reduce((total, stock) =>
      total + (parseFloat(String(stock.cantidad_reservada)) || 0), 0
    );

    // Obtener todas las bodegas activas
    const todasBodegas = await Bodega.findAll({
      where: { activa: true },
      attributes: ['id_bodega', 'nombre', 'codigo'],
      order: [['nombre', 'ASC']]
    });

    // Organizar variantes con su stock por bodega (para el modal de detalle)
    const variantesConStock = variantes.map(v => {
      const descripcion = [v.color, v.medida, v.material].filter(Boolean).join(' / ');

      // Crear mapa de stock por bodega para esta variante
      const stockMap = new Map();
      stockPorBodega.forEach((s: any) => {
        if (s.id_variante_producto === v.id_variante_producto && s.bodega) {
          stockMap.set(s.bodega.id_bodega, {
            id_bodega: s.bodega.id_bodega,
            nombre: s.bodega.nombre,
            codigo: s.bodega.codigo,
            cantidad_disponible: parseFloat(s.cantidad_disponible) || 0,
            cantidad_reservada: parseFloat(s.cantidad_reservada) || 0
          });
        }
      });

      // Incluir todas las bodegas (con 0 si no tiene stock)
      const stock_bodegas = todasBodegas.map(b => {
        const stockExistente = stockMap.get(b.id_bodega);
        return stockExistente || {
          id_bodega: b.id_bodega,
          nombre: b.nombre,
          codigo: b.codigo,
          cantidad_disponible: 0,
          cantidad_reservada: 0
        };
      });

      const varianteStockTotal = stock_bodegas.reduce((sum, s) => sum + s.cantidad_disponible, 0);

      return {
        id_variante: v.id_variante_producto,
        sku: v.sku,
        descripcion,
        stock_bodegas,
        stock_total: varianteStockTotal
      };
    });

    res.json({
      success: true,
      data: {
        producto: {
          id_producto: producto.id_producto,
          modelo: producto.nombre,
          codigo: producto.codigo,
          descripcion: producto.descripcion,
          categoria: (producto as any).categoria?.nombre || null
        },
        bodegas: todasBodegas,
        variantes: variantesConStock,
        stock_total_producto: stockTotal,
        // Mantener compatibilidad con código existente
        stock_por_bodega: stockPorBodega,
        resumen: {
          stock_total_disponible: stockTotal,
          stock_total_reservado: stockReservadoTotal,
          stock_minimo: producto.stock_minimo_total,
          estado: getStockStatus(stockTotal, producto.stock_minimo_total)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/bodega/:bodegaId
// =======================================================
router.get('/bodega/:bodegaId', async (req, res, next) => {
  try {
    const { bodegaId } = req.params;

    const bodega = await Bodega.findByPk(bodegaId);
    if (!bodega) {
      return res.status(404).json({ success: false, message: 'Bodega no encontrada' });
    }

    const stockBodega = await StockPorBodega.findAll({
      where: { id_bodega: bodegaId },
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto',
            include: [{
              model: Categoria,
              as: 'categoria',
              attributes: ['nombre']
            }]
          }]
        }
      ],
      order: [['id_stock', 'DESC']]
    });

    const resumen = {
      total_productos: stockBodega.length,
      productos_con_stock: stockBodega.filter(s => s.cantidad_disponible > 0).length,
      productos_sin_stock: stockBodega.filter(s => s.cantidad_disponible === 0).length,
      valor_total_inventario: stockBodega.reduce((total, stock) =>
        total + (stock.cantidad_disponible * (stock.varianteProducto?.producto?.precio_costo_base ?? 0)), 0
      )
    };

    res.json({
      success: true,
      data: {
        bodega,
        stock: stockBodega,
        resumen
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// POST /stock/entrada : Registrar entrada de stock
// =======================================================
router.post('/entrada', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_variante_producto, id_bodega, cantidad, motivo, referencia } = req.body;
    const id_usuario = (req as any).user?.id; // Token usa 'id', no 'id_usuario'

    if (!id_variante_producto || !id_bodega || !cantidad || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: id_variante_producto, id_bodega, cantidad, motivo'
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    const variante = await VarianteProducto.findByPk(id_variante_producto, { transaction });
    if (!variante) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Variante de producto no encontrada'
      });
    }

    const bodega = await Bodega.findByPk(id_bodega, { transaction });
    if (!bodega || !bodega.activa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bodega no encontrada o inactiva'
      });
    }

    let stockBodega = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega },
      transaction
    });

    const stockAnterior = stockBodega?.cantidad_disponible || 0;
    const stockNuevo = Number(stockAnterior) + Number(cantidad);

    if (stockBodega) {
      await stockBodega.update({
        cantidad_disponible: stockNuevo,
        fecha_actualizacion: new Date()
      }, { transaction });
    } else {
      stockBodega = await StockPorBodega.create({
        id_variante_producto,
        id_bodega,
        cantidad_disponible: cantidad,
        cantidad_reservada: 0,
        stock_minimo: 0,
        stock_maximo: 0
      }, { transaction });
    }

    const movimiento = await MovimientoStock.create({
      id_variante_producto,
      id_bodega,
      tipo_movimiento: 'entrada',
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      motivo,
      referencia,
      id_usuario
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Entrada de stock registrada exitosamente',
      data: {
        movimiento,
        stock_actual: stockNuevo
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// =======================================================
// POST /stock/salida : Registrar salida de stock
// =======================================================
router.post('/salida', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_variante_producto, id_bodega, cantidad, motivo, referencia } = req.body;
    const id_usuario = (req as any).user?.id; // Token usa 'id', no 'id_usuario'

    if (!id_variante_producto || !id_bodega || !cantidad || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: id_variante_producto, id_bodega, cantidad, motivo'
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    const stockBodega = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega },
      transaction
    });

    if (!stockBodega) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'No existe stock de esta variante en la bodega especificada'
      });
    }

    const stockAnterior = Number(stockBodega.cantidad_disponible);

    if (stockAnterior < cantidad) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Disponible: ${stockAnterior}, Solicitado: ${cantidad}`
      });
    }

    const stockNuevo = stockAnterior - Number(cantidad);

    await stockBodega.update({
      cantidad_disponible: stockNuevo,
      fecha_actualizacion: new Date()
    }, { transaction });

    const movimiento = await MovimientoStock.create({
      id_variante_producto,
      id_bodega,
      tipo_movimiento: 'salida',
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      motivo,
      referencia,
      id_usuario
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Salida de stock registrada exitosamente',
      data: {
        movimiento,
        stock_actual: stockNuevo
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// =======================================================
// POST /stock/ajuste : Ajuste de inventario
// =======================================================
router.post('/ajuste', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_variante_producto, id_bodega, cantidad_nueva, motivo, referencia } = req.body;
    const id_usuario = (req as any).user?.id; // Token usa 'id', no 'id_usuario'

    if (!id_variante_producto || !id_bodega || cantidad_nueva === undefined || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: id_variante_producto, id_bodega, cantidad_nueva, motivo'
      });
    }

    if (cantidad_nueva < 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad no puede ser negativa'
      });
    }

    let stockBodega = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega },
      transaction
    });

    const stockAnterior = stockBodega?.cantidad_disponible || 0;
    const diferencia = Number(cantidad_nueva) - Number(stockAnterior);

    if (stockBodega) {
      await stockBodega.update({
        cantidad_disponible: cantidad_nueva,
        fecha_actualizacion: new Date()
      }, { transaction });
    } else {
      stockBodega = await StockPorBodega.create({
        id_variante_producto,
        id_bodega,
        cantidad_disponible: cantidad_nueva,
        cantidad_reservada: 0,
        stock_minimo: 0,
        stock_maximo: 0
      }, { transaction });
    }

    const movimiento = await MovimientoStock.create({
      id_variante_producto,
      id_bodega,
      tipo_movimiento: 'ajuste',
      cantidad: Math.abs(diferencia),
      stock_anterior: stockAnterior,
      stock_nuevo: cantidad_nueva,
      motivo: `${motivo} (${diferencia >= 0 ? '+' : ''}${diferencia})`,
      referencia,
      id_usuario
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Ajuste de inventario registrado exitosamente',
      data: {
        movimiento,
        stock_anterior: stockAnterior,
        stock_nuevo: cantidad_nueva,
        diferencia
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// =======================================================
// POST /stock/transferencia : Transferir entre bodegas
// =======================================================
router.post('/transferencia', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_variante_producto, id_bodega_origen, id_bodega_destino, cantidad, motivo } = req.body;
    const id_usuario = (req as any).user?.id; // Token usa 'id', no 'id_usuario'

    if (!id_variante_producto || !id_bodega_origen || !id_bodega_destino || !cantidad) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: id_variante_producto, id_bodega_origen, id_bodega_destino, cantidad'
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    if (id_bodega_origen === id_bodega_destino) {
      return res.status(400).json({
        success: false,
        message: 'La bodega origen y destino no pueden ser la misma'
      });
    }

    const [bodegaOrigen, bodegaDestino] = await Promise.all([
      Bodega.findByPk(id_bodega_origen, { transaction }),
      Bodega.findByPk(id_bodega_destino, { transaction })
    ]);

    if (!bodegaOrigen || !bodegaOrigen.activa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bodega origen no encontrada o inactiva'
      });
    }

    if (!bodegaDestino || !bodegaDestino.activa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bodega destino no encontrada o inactiva'
      });
    }

    const stockOrigen = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega: id_bodega_origen },
      transaction
    });

    if (!stockOrigen || Number(stockOrigen.cantidad_disponible) < cantidad) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente en bodega origen. Disponible: ${stockOrigen?.cantidad_disponible || 0}`
      });
    }

    const stockAnteriorOrigen = Number(stockOrigen.cantidad_disponible);
    const stockNuevoOrigen = stockAnteriorOrigen - Number(cantidad);

    await stockOrigen.update({
      cantidad_disponible: stockNuevoOrigen,
      fecha_actualizacion: new Date()
    }, { transaction });

    let stockDestino = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega: id_bodega_destino },
      transaction
    });

    const stockAnteriorDestino = stockDestino?.cantidad_disponible || 0;
    const stockNuevoDestino = Number(stockAnteriorDestino) + Number(cantidad);

    if (stockDestino) {
      await stockDestino.update({
        cantidad_disponible: stockNuevoDestino,
        fecha_actualizacion: new Date()
      }, { transaction });
    } else {
      stockDestino = await StockPorBodega.create({
        id_variante_producto,
        id_bodega: id_bodega_destino,
        cantidad_disponible: cantidad,
        cantidad_reservada: 0,
        stock_minimo: 0,
        stock_maximo: 0
      }, { transaction });
    }

    const movimiento = await MovimientoStock.create({
      id_variante_producto,
      id_bodega: id_bodega_origen,
      tipo_movimiento: 'transferencia',
      cantidad,
      stock_anterior: stockAnteriorOrigen,
      stock_nuevo: stockNuevoOrigen,
      id_bodega_destino,
      motivo: motivo || `Transferencia a ${bodegaDestino.nombre}`,
      id_usuario
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Transferencia realizada exitosamente',
      data: {
        movimiento,
        origen: {
          bodega: bodegaOrigen.nombre,
          stock_anterior: stockAnteriorOrigen,
          stock_nuevo: stockNuevoOrigen
        },
        destino: {
          bodega: bodegaDestino.nombre,
          stock_anterior: stockAnteriorDestino,
          stock_nuevo: stockNuevoDestino
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// =======================================================
// GET /stock/movimientos : Historial de movimientos
// =======================================================
router.get('/movimientos', async (req, res, next) => {
  try {
    const {
      id_bodega,
      id_variante_producto,
      tipo_movimiento,
      fecha_desde,
      fecha_hasta,
      limit = 50,
      offset = 0
    } = req.query;

    const whereClause: any = {};

    if (id_bodega) whereClause.id_bodega = id_bodega;
    if (id_variante_producto) whereClause.id_variante_producto = id_variante_producto;
    if (tipo_movimiento) whereClause.tipo_movimiento = tipo_movimiento;

    if (fecha_desde || fecha_hasta) {
      whereClause.fecha_movimiento = {};
      if (fecha_desde) whereClause.fecha_movimiento[Op.gte] = new Date(fecha_desde as string);
      if (fecha_hasta) whereClause.fecha_movimiento[Op.lte] = new Date(fecha_hasta as string);
    }

    const { count, rows: movimientos } = await MovimientoStock.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto',
            attributes: ['id_producto', 'codigo', 'nombre', 'tipo']
          }]
        },
        {
          model: Bodega,
          as: 'bodega',
          attributes: ['id_bodega', 'codigo', 'nombre']
        },
        {
          model: Bodega,
          as: 'bodegaDestino',
          attributes: ['id_bodega', 'codigo', 'nombre']
        },
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id_usuario', 'usuario', 'nombre_completo']
        }
      ],
      order: [['fecha_movimiento', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({
      success: true,
      data: movimientos,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset),
        pages: Math.ceil(count / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// POST /stock/entrada-masiva : Registrar múltiples entradas de stock
// =======================================================
router.post('/entrada-masiva', async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_bodega, motivo, referencia, entradas } = req.body;
    const id_usuario = (req as any).user?.id;

    // Validaciones básicas
    if (!id_bodega || !motivo || !entradas || !Array.isArray(entradas) || entradas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: id_bodega, motivo, entradas (array)'
      });
    }

    // Validar que la bodega existe y está activa
    const bodega = await Bodega.findByPk(id_bodega, { transaction });
    if (!bodega || !bodega.activa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bodega no encontrada o inactiva'
      });
    }

    // Validar cada entrada
    for (let i = 0; i < entradas.length; i++) {
      const entrada = entradas[i];
      if (!entrada.id_variante_producto || !entrada.cantidad) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Entrada ${i + 1}: Faltan campos requeridos (id_variante_producto, cantidad)`
        });
      }
      if (entrada.cantidad <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Entrada ${i + 1}: La cantidad debe ser mayor a 0`
        });
      }
    }

    // Obtener todos los IDs de variantes para validar existencia
    const varianteIds = entradas.map(e => e.id_variante_producto);
    const variantes = await VarianteProducto.findAll({
      where: { id_variante_producto: varianteIds },
      include: [{
        model: Producto,
        as: 'producto',
        attributes: ['nombre', 'codigo']
      }],
      transaction
    });

    const variantesMap = new Map(variantes.map(v => [v.id_variante_producto, v]));

    // Verificar que todas las variantes existan
    for (const entrada of entradas) {
      if (!variantesMap.has(entrada.id_variante_producto)) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: `Variante con ID ${entrada.id_variante_producto} no encontrada`
        });
      }
    }

    // Procesar todas las entradas
    const resultados: any[] = [];
    const movimientos: any[] = [];

    for (const entrada of entradas) {
      const { id_variante_producto, cantidad } = entrada;
      const variante = variantesMap.get(id_variante_producto);

      // Buscar o crear stock en bodega
      let stockBodega = await StockPorBodega.findOne({
        where: { id_variante_producto, id_bodega },
        transaction
      });

      const stockAnterior = stockBodega?.cantidad_disponible || 0;
      const stockNuevo = Number(stockAnterior) + Number(cantidad);

      if (stockBodega) {
        await stockBodega.update({
          cantidad_disponible: stockNuevo,
          fecha_actualizacion: new Date()
        }, { transaction });
      } else {
        stockBodega = await StockPorBodega.create({
          id_variante_producto,
          id_bodega,
          cantidad_disponible: cantidad,
          cantidad_reservada: 0,
          stock_minimo: 0,
          stock_maximo: 0
        }, { transaction });
      }

      // Crear movimiento
      const movimiento = await MovimientoStock.create({
        id_variante_producto,
        id_bodega,
        tipo_movimiento: 'entrada',
        cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        motivo,
        referencia: referencia || 'Ingreso masivo',
        id_usuario
      }, { transaction });

      movimientos.push(movimiento);
      resultados.push({
        id_variante_producto,
        sku: variante?.sku,
        producto: variante?.producto?.nombre,
        color: variante?.color,
        cantidad_ingresada: cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo
      });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Se registraron ${entradas.length} entradas de stock exitosamente`,
      data: {
        bodega: bodega.nombre,
        motivo,
        referencia,
        total_entradas: entradas.length,
        total_cantidad: entradas.reduce((sum, e) => sum + Number(e.cantidad), 0),
        detalles: resultados
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// =======================================================
// POST /stock/importar-excel : Importar stock desde Excel
// =======================================================
router.post('/importar-excel', async (req, res, next) => {
  const multer = require('multer');
  const ExcelJS = require('exceljs');
  const upload = multer({ storage: multer.memoryStorage() });

  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, message: 'Error al subir archivo' });
    }

    const transaction = await sequelize.transaction();

    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });
      }

      const { id_bodega, motivo = 'Importación desde Excel' } = req.body;
      const id_usuario = (req as any).user?.id;

      if (!id_bodega) {
        return res.status(400).json({ success: false, message: 'Se requiere id_bodega' });
      }

      // Validar bodega
      const bodega = await Bodega.findByPk(id_bodega, { transaction });
      if (!bodega || !bodega.activa) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Bodega no encontrada o inactiva' });
      }

      // Leer archivo Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'El archivo Excel está vacío' });
      }

      // Buscar columnas por nombre (flexible)
      const headerRow = worksheet.getRow(1);
      let skuCol = -1, cantidadCol = -1;

      headerRow.eachCell((cell: any, colNumber: number) => {
        const value = String(cell.value || '').toLowerCase().trim();
        if (value === 'sku' || value === 'codigo' || value === 'código') {
          skuCol = colNumber;
        } else if (value === 'cantidad' || value === 'metros' || value === 'mts' || value === 'qty') {
          cantidadCol = colNumber;
        }
      });

      if (skuCol === -1 || cantidadCol === -1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El archivo debe tener columnas "SKU" y "Cantidad" en la primera fila'
        });
      }

      // Procesar filas
      const resultados: any[] = [];
      const erroresLinea: any[] = [];
      let filasProcesadas = 0;

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const sku = String(row.getCell(skuCol).value || '').trim();
        const cantidadRaw = row.getCell(cantidadCol).value;
        const cantidad = Number(cantidadRaw);

        // Saltar filas vacías
        if (!sku && !cantidadRaw) continue;

        // Validar datos
        if (!sku) {
          erroresLinea.push({ fila: rowNumber, error: 'SKU vacío' });
          continue;
        }
        if (isNaN(cantidad) || cantidad <= 0) {
          erroresLinea.push({ fila: rowNumber, sku, error: 'Cantidad inválida' });
          continue;
        }

        // Buscar variante por SKU
        const variante = await VarianteProducto.findOne({
          where: { sku },
          include: [{
            model: Producto,
            as: 'producto',
            attributes: ['nombre', 'codigo']
          }],
          transaction
        });

        if (!variante) {
          erroresLinea.push({ fila: rowNumber, sku, error: 'SKU no encontrado' });
          continue;
        }

        // Buscar o crear stock en bodega
        let stockBodega = await StockPorBodega.findOne({
          where: { id_variante_producto: variante.id_variante_producto, id_bodega },
          transaction
        });

        const stockAnterior = stockBodega?.cantidad_disponible || 0;
        const stockNuevo = Number(stockAnterior) + cantidad;

        if (stockBodega) {
          await stockBodega.update({
            cantidad_disponible: stockNuevo,
            fecha_actualizacion: new Date()
          }, { transaction });
        } else {
          stockBodega = await StockPorBodega.create({
            id_variante_producto: variante.id_variante_producto,
            id_bodega,
            cantidad_disponible: cantidad,
            cantidad_reservada: 0,
            stock_minimo: 0,
            stock_maximo: 0
          }, { transaction });
        }

        // Crear movimiento
        await MovimientoStock.create({
          id_variante_producto: variante.id_variante_producto,
          id_bodega,
          tipo_movimiento: 'entrada',
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          motivo,
          referencia: `Importación Excel - Fila ${rowNumber}`,
          id_usuario
        }, { transaction });

        resultados.push({
          fila: rowNumber,
          sku,
          producto: variante.producto?.nombre,
          cantidad_ingresada: cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo
        });

        filasProcesadas++;
      }

      // Si hay errores pero también éxitos, continuar (parcial)
      // Si todo falla, rollback
      if (filasProcesadas === 0 && erroresLinea.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se pudo procesar ninguna fila del archivo',
          errores: erroresLinea
        });
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: `Se importaron ${filasProcesadas} registros de stock`,
        data: {
          bodega: bodega.nombre,
          total_importados: filasProcesadas,
          total_cantidad: resultados.reduce((sum, r) => sum + r.cantidad_ingresada, 0),
          detalles: resultados,
          errores: erroresLinea.length > 0 ? erroresLinea : undefined
        }
      });

    } catch (error: any) {
      await transaction.rollback();
      console.error('Error importando stock desde Excel:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al importar archivo Excel'
      });
    }
  });
});

// =======================================================
// GET /stock/bajo-minimo : Productos bajo stock mínimo
// =======================================================
router.get('/bajo-minimo', async (req, res, next) => {
  try {
    const { id_bodega } = req.query;

    const whereClause: any = {};
    if (id_bodega) whereClause.id_bodega = id_bodega;

    const stockBodega = await StockPorBodega.findAll({
      where: whereClause,
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto',
          include: [{
            model: Producto,
            as: 'producto',
            include: [{
              model: Categoria,
              as: 'categoria',
              attributes: ['nombre']
            }]
          }]
        },
        {
          model: Bodega,
          as: 'bodega',
          attributes: ['id_bodega', 'codigo', 'nombre'],
          where: { activa: true }
        }
      ]
    });

    // Filtrar productos bajo mínimo
    const bajoMinimo = stockBodega.filter(stock => {
      const minimo = stock.stock_minimo || stock.varianteProducto?.stock_minimo || 0;
      return stock.cantidad_disponible < minimo && minimo > 0;
    });

    const resultado = bajoMinimo.map(stock => {
      const minimo = stock.stock_minimo || stock.varianteProducto?.stock_minimo || 0;
      return {
        ...stock.toJSON(),
        deficit: minimo - stock.cantidad_disponible,
        porcentaje_stock: minimo > 0 ? Math.round((stock.cantidad_disponible / minimo) * 100) : 0
      };
    });

    res.json({
      success: true,
      data: resultado,
      resumen: {
        total_alertas: resultado.length,
        criticos: resultado.filter(r => r.cantidad_disponible === 0).length,
        bajos: resultado.filter(r => r.cantidad_disponible > 0).length
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/variante/:varianteId : Stock de una variante
// =======================================================
router.get('/variante/:varianteId', async (req, res, next) => {
  try {
    const { varianteId } = req.params;

    const variante = await VarianteProducto.findByPk(varianteId, {
      include: [{
        model: Producto,
        as: 'producto',
        include: [{
          model: Categoria,
          as: 'categoria',
          attributes: ['nombre']
        }]
      }]
    });

    if (!variante) {
      return res.status(404).json({
        success: false,
        message: 'Variante no encontrada'
      });
    }

    const stockPorBodega = await StockPorBodega.findAll({
      where: { id_variante_producto: varianteId },
      include: [{
        model: Bodega,
        as: 'bodega',
        attributes: ['id_bodega', 'codigo', 'nombre', 'es_punto_venta'],
        where: { activa: true }
      }],
      order: [['id_stock', 'DESC']]
    });

    const stockTotal = stockPorBodega.reduce((sum, s) => sum + Number(s.cantidad_disponible), 0);
    const reservadoTotal = stockPorBodega.reduce((sum, s) => sum + Number(s.cantidad_reservada), 0);

    res.json({
      success: true,
      data: {
        variante: {
          id_variante_producto: variante.id_variante_producto,
          sku: variante.sku,
          color: variante.color,
          medida: variante.medida,
          material: variante.material,
          producto: variante.producto
        },
        stock_por_bodega: stockPorBodega,
        resumen: {
          stock_total: stockTotal,
          reservado_total: reservadoTotal,
          bodegas_con_stock: stockPorBodega.filter(s => s.cantidad_disponible > 0).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
