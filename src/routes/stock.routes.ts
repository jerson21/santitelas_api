import { Router, Request, Response } from 'express';
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

// TypeScript: La interfaz Request está extendida en middlewares/auth.ts

// Helper para estado del stock
function getStockStatus(cantidadDisponible: number, stockMinimo: number): string {
  if (cantidadDisponible === 0) return 'sin_stock';
  if (cantidadDisponible < stockMinimo) return 'bajo_minimo';
  if (cantidadDisponible <= stockMinimo * 1.5) return 'alerta';
  return 'normal';
}

// Helper para obtener ID de usuario usando la estructura correcta del middleware auth
function getUserId(req: Request): number | null {
  // req.user ya está tipado correctamente por el middleware auth
  return req.user?.id || null;
}

// Helper para registrar movimiento de stock
async function registrarMovimientoStock(data: {
  id_variante_producto: number;
  id_bodega: number;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  cantidad: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  motivo?: string;
  id_usuario: number;
  observaciones?: string;
}) {
  try {
    await MovimientoStock.create({
      ...data,
      fecha_movimiento: new Date()
    });
  } catch (error) {
    console.error('Error registrando movimiento de stock:', error);
  }
}

// =======================================================
// GET /stock : Stock general
// =======================================================
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { bodega, categoria, bajo_minimo, sin_stock } = req.query;

    const whereClause: any = {};
    if (bodega) whereClause.id_bodega = bodega;
    if (sin_stock === 'true') whereClause.cantidad_disponible = 0;

    // ✅ CORREGIDO: Agregar alias a todas las relaciones
    const includeVariante: any = {
      model: VarianteProducto,
      as: 'varianteProducto', // ✅ ALIAS AGREGADO
      include: [{
        model: Producto,
        as: 'producto', // ✅ ALIAS AGREGADO
        include: [{
          model: Categoria,
          as: 'categoria', // ✅ ALIAS AGREGADO
          attributes: ['id_categoria', 'nombre']
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
          as: 'bodega', // ✅ ALIAS AGREGADO
          attributes: ['id_bodega', 'nombre', 'codigo'],
          where: { activa: true }
        }
      ],
      order: [
        [{ model: VarianteProducto, as: 'varianteProducto' }, { model: Producto, as: 'producto' }, 'nombre', 'ASC'],
        [{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']
      ]
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
router.get('/producto/:productoId', async (req: Request, res: Response, next) => {
  try {
    const { productoId } = req.params;

    const producto = await Producto.findByPk(productoId, {
      include: [{
        model: Categoria,
        as: 'categoria', // ✅ ALIAS AGREGADO
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
          as: 'varianteProducto', // ✅ ALIAS AGREGADO
          include: [{ 
            model: Producto, 
            as: 'producto' // ✅ ALIAS AGREGADO
          }]
        },
        {
          model: Bodega,
          as: 'bodega', // ✅ ALIAS AGREGADO
          attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta'],
          where: { activa: true }
        }
      ],
      order: [[{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']]
    });

    const stockTotal = stockPorBodega.reduce((total, stock) =>
      total + stock.cantidad_disponible, 0
    );

    const stockReservadoTotal = stockPorBodega.reduce((total, stock) =>
      total + stock.cantidad_reservada, 0
    );

    res.json({
      success: true,
      data: {
        producto,
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
router.get('/bodega/:bodegaId', async (req: Request, res: Response, next) => {
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
          as: 'varianteProducto', // ✅ ALIAS AGREGADO
          include: [{
            model: Producto,
            as: 'producto', // ✅ ALIAS AGREGADO
            include: [{ 
              model: Categoria, 
              as: 'categoria', // ✅ ALIAS AGREGADO
              attributes: ['nombre'] 
            }]
          }]
        }
      ],
      order: [[{ model: VarianteProducto, as: 'varianteProducto' }, { model: Producto, as: 'producto' }, 'nombre', 'ASC']]
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
// GET /stock/variante/:varianteId
// =======================================================
router.get('/variante/:varianteId', async (req: Request, res: Response, next) => {
  try {
    const { varianteId } = req.params;

    const variante = await VarianteProducto.findByPk(varianteId, {
      include: [{
        model: Producto,
        as: 'producto', // ✅ ALIAS AGREGADO
        include: [{ 
          model: Categoria, 
          as: 'categoria', // ✅ ALIAS AGREGADO
          attributes: ['nombre'] 
        }]
      }]
    });

    if (!variante) {
      return res.status(404).json({ success: false, message: 'Variante no encontrada' });
    }

    const stockPorBodega = await StockPorBodega.findAll({
      where: { id_variante_producto: varianteId },
      include: [{
        model: Bodega,
        as: 'bodega', // ✅ ALIAS AGREGADO
        attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta'],
        where: { activa: true }
      }],
      order: [[{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']]
    });

    const stockTotal = stockPorBodega.reduce((total, stock) => total + stock.cantidad_disponible, 0);
    const stockReservado = stockPorBodega.reduce((total, stock) => total + stock.cantidad_reservada, 0);

    res.json({
      success: true,
      data: {
        variante,
        stock_por_bodega: stockPorBodega,
        resumen: {
          stock_total_disponible: stockTotal,
          stock_total_reservado: stockReservado,
          stock_minimo: variante.producto?.stock_minimo_total ?? 0,
          estado: getStockStatus(stockTotal, variante.producto?.stock_minimo_total ?? 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// PATCH /stock/variante/:varianteId - Actualizar stock de variante
// =======================================================
router.patch('/variante/:varianteId', async (req: Request, res: Response, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { varianteId } = req.params;
    const { stock, motivo, id_bodega } = req.body;
    const userId = getUserId(req);

    // Validaciones
    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'El stock debe ser un número mayor o igual a 0'
      });
    }

    // Verificar que la variante existe
    const variante = await VarianteProducto.findByPk(varianteId, {
      include: [{ 
        model: Producto, 
        as: 'producto' // ✅ ALIAS AGREGADO
      }]
    });

    if (!variante) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Variante no encontrada' });
    }

    // Determinar bodega
    let bodegaId = id_bodega;
    if (!bodegaId) {
      const bodegaPrincipal = await Bodega.findOne({
        where: { activa: true },
        order: [['id_bodega', 'ASC']]
      });
      if (!bodegaPrincipal) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'No se encontró una bodega activa' });
      }
      bodegaId = bodegaPrincipal.id_bodega;
    }

    // Convertir IDs a números
    const varianteIdNum = parseInt(varianteId);
    const bodegaIdNum = parseInt(bodegaId);

    // Buscar o crear registro de stock
    let stockRecord = await StockPorBodega.findOne({
      where: {
        id_variante_producto: varianteIdNum,
        id_bodega: bodegaIdNum
      },
      transaction
    });

    const stockAnterior = stockRecord?.cantidad_disponible ?? 0;

    if (!stockRecord) {
      stockRecord = await StockPorBodega.create({
        id_variante_producto: varianteIdNum,
        id_bodega: bodegaIdNum,
        cantidad_disponible: stock,
        cantidad_reservada: 0,
        ubicacion: null
      }, { transaction });
    } else {
      await stockRecord.update({
        cantidad_disponible: stock
      }, { transaction });
    }

    // Registrar movimiento de stock
    if (userId) {
      const diferencia = stock - stockAnterior;
      const tipoMovimiento = diferencia > 0 ? 'entrada' : diferencia < 0 ? 'salida' : 'ajuste';
      
      await registrarMovimientoStock({
        id_variante_producto: varianteIdNum,
        id_bodega: bodegaIdNum,
        tipo_movimiento: tipoMovimiento,
        cantidad: Math.abs(diferencia),
        cantidad_anterior: stockAnterior,
        cantidad_nueva: stock,
        motivo: motivo || 'Actualización manual',
        id_usuario: userId,
        observaciones: `Stock actualizado desde panel de administración`
      });
    }

    await transaction.commit();

    // Calcular stock total actualizado
    const stockTotal = await StockPorBodega.sum('cantidad_disponible', {
      where: { id_variante_producto: varianteIdNum }
    }) || 0;

    res.json({
      success: true,
      message: 'Stock actualizado exitosamente',
      data: {
        stock_anterior: stockAnterior,
        stock_nuevo: stock,
        stock_total: stockTotal,
        bodega_id: bodegaIdNum,
        diferencia: stock - stockAnterior
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error actualizando stock:', error);
    next(error);
  }
});

// =======================================================
// PATCH /stock/masivo - Actualización masiva de stock
// =======================================================
router.patch('/masivo', async (req: Request, res: Response, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { variantes, operation, amount, reason, id_bodega } = req.body;
    const userId = getUserId(req);

    // Validaciones
    if (!Array.isArray(variantes) || variantes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos una variante'
      });
    }

    if (!['set', 'add', 'subtract'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'Operación no válida. Use: set, add, subtract'
      });
    }

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser un número mayor o igual a 0'
      });
    }

    // Determinar bodega
    let bodegaId = id_bodega;
    if (!bodegaId) {
      const bodegaPrincipal = await Bodega.findOne({
        where: { activa: true },
        order: [['id_bodega', 'ASC']]
      });
      if (!bodegaPrincipal) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'No se encontró una bodega activa' });
      }
      bodegaId = bodegaPrincipal.id_bodega;
    }

    const bodegaIdNum = parseInt(bodegaId);
    const resultados = [];

    for (const varianteIdStr of variantes) {
      try {
        const varianteIdNum = parseInt(varianteIdStr);
        
        // Verificar que la variante existe
        const variante = await VarianteProducto.findByPk(varianteIdNum, { transaction });
        if (!variante) {
          resultados.push({
            variante_id: varianteIdNum,
            success: false,
            message: 'Variante no encontrada'
          });
          continue;
        }

        // Buscar stock actual
        let stockRecord = await StockPorBodega.findOne({
          where: {
            id_variante_producto: varianteIdNum,
            id_bodega: bodegaIdNum
          },
          transaction
        });

        const stockAnterior = stockRecord?.cantidad_disponible ?? 0;
        let nuevoStock: number;

        // Calcular nuevo stock según la operación
        switch (operation) {
          case 'set':
            nuevoStock = amount;
            break;
          case 'add':
            nuevoStock = stockAnterior + amount;
            break;
          case 'subtract':
            nuevoStock = Math.max(0, stockAnterior - amount);
            break;
          default:
            nuevoStock = stockAnterior;
        }

        // Crear o actualizar registro
        if (!stockRecord) {
          stockRecord = await StockPorBodega.create({
            id_variante_producto: varianteIdNum,
            id_bodega: bodegaIdNum,
            cantidad_disponible: nuevoStock,
            cantidad_reservada: 0,
            ubicacion: null
          }, { transaction });
        } else {
          await stockRecord.update({
            cantidad_disponible: nuevoStock
          }, { transaction });
        }

        // Registrar movimiento
        if (userId && stockAnterior !== nuevoStock) {
          const diferencia = nuevoStock - stockAnterior;
          const tipoMovimiento = diferencia > 0 ? 'entrada' : diferencia < 0 ? 'salida' : 'ajuste';
          
          await registrarMovimientoStock({
            id_variante_producto: varianteIdNum,
            id_bodega: bodegaIdNum,
            tipo_movimiento: tipoMovimiento,
            cantidad: Math.abs(diferencia),
            cantidad_anterior: stockAnterior,
            cantidad_nueva: nuevoStock,
            motivo: reason || `Actualización masiva - ${operation}`,
            id_usuario: userId,
            observaciones: `Actualización masiva desde panel de administración`
          });
        }

        resultados.push({
          variante_id: varianteIdNum,
          success: true,
          stock_anterior: stockAnterior,
          stock_nuevo: nuevoStock,
          diferencia: nuevoStock - stockAnterior
        });

      } catch (error) {
        console.error(`Error procesando variante ${varianteIdStr}:`, error);
        resultados.push({
          variante_id: varianteIdStr,
          success: false,
          message: 'Error interno procesando variante'
        });
      }
    }

    await transaction.commit();

    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Actualización masiva completada. ${exitosos} exitosas, ${fallidos} fallidas`,
      data: {
        resultados,
        resumen: {
          total: resultados.length,
          exitosos,
          fallidos,
          operation,
          amount,
          bodega_id: bodegaIdNum
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error en actualización masiva:', error);
    next(error);
  }
});

// =======================================================
// GET /stock/movimientos/:varianteId - Historial de movimientos
// =======================================================
router.get('/movimientos/:varianteId', async (req: Request, res: Response, next) => {
  try {
    const { varianteId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const movimientos = await MovimientoStock.findAndCountAll({
      where: { id_variante_producto: parseInt(varianteId) },
      include: [
        {
          model: Usuario,
          as: 'usuario', // ✅ ALIAS AGREGADO
          attributes: ['id_usuario', 'nombre', 'email']
        },
        {
          model: Bodega,
          as: 'bodega', // ✅ ALIAS AGREGADO
          attributes: ['id_bodega', 'nombre', 'codigo']
        },
        {
          model: VarianteProducto,
          as: 'varianteProducto', // ✅ ALIAS AGREGADO
          include: [{
            model: Producto,
            as: 'producto', // ✅ ALIAS AGREGADO
            attributes: ['nombre', 'codigo']
          }]
        }
      ],
      order: [['fecha_movimiento', 'DESC']],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: movimientos.rows,
      pagination: {
        total: movimientos.count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        pages: Math.ceil(movimientos.count / parseInt(limit as string))
      }
    });

  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/alertas - Productos con stock bajo
// =======================================================
router.get('/alertas', async (req: Request, res: Response, next) => {
  try {
    const stockBajo = await StockPorBodega.findAll({
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto', // ✅ ALIAS AGREGADO
          include: [{
            model: Producto,
            as: 'producto', // ✅ ALIAS AGREGADO
            where: { activo: true },
            include: [{ 
              model: Categoria, 
              as: 'categoria', // ✅ ALIAS AGREGADO
              attributes: ['nombre'] 
            }]
          }]
        },
        {
          model: Bodega,
          as: 'bodega', // ✅ ALIAS AGREGADO
          attributes: ['id_bodega', 'nombre', 'codigo'],
          where: { activa: true }
        }
      ],
      order: [
        [{ model: VarianteProducto, as: 'varianteProducto' }, { model: Producto, as: 'producto' }, 'nombre', 'ASC']
      ]
    });

    const alertas = stockBajo.filter(stock => {
      const stockMinimo = stock.varianteProducto?.producto?.stock_minimo_total ?? 0;
      return stock.cantidad_disponible <= stockMinimo;
    }).map(stock => {
      const producto = stock.varianteProducto?.producto;
      const stockMinimo = producto?.stock_minimo_total ?? 0;
      
      return {
        ...stock.toJSON(),
        estado_stock: getStockStatus(stock.cantidad_disponible, stockMinimo),
        dias_estimados_agotamiento: stock.cantidad_disponible > 0 ? 
          Math.floor(stock.cantidad_disponible / (stockMinimo / 30)) : 0
      };
    });

    const sinStock = alertas.filter(a => a.cantidad_disponible === 0);
    const bajoMinimo = alertas.filter(a => a.cantidad_disponible > 0);

    res.json({
      success: true,
      data: alertas,
      resumen: {
        total_alertas: alertas.length,
        sin_stock: sinStock.length,
        bajo_minimo: bajoMinimo.length
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;