// src/routes/stock-bodega.routes.ts - Nuevas funcionalidades para gestión por bodega
import { Router, Request, Response } from 'express';
import { auth } from '../middlewares/auth';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { MovimientoStock } from '../models/MovimientoStock.model';
import { Producto } from '../models/Producto.model';
import { Bodega } from '../models/Bodega.model';
import { Usuario } from '../models/Usuario.model';

import { VarianteProducto } from '../models/VarianteProducto.model';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

const router = Router();
router.use(auth);

// Helper para registrar movimiento de stock
async function registrarMovimientoStock(data: {
  id_variante_producto: number;
  id_bodega: number;
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string;
  id_usuario: number;
  id_bodega_destino?: number;
  referencia?: string;
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

// TypeScript: Usando alias correctos según asociaciones definidas en models/index.ts
// POST /stock-bodega/transferir - Transferir stock entre bodegas
// =======================================================
router.post('/transferir', async (req: Request, res: Response, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { 
      id_variante_producto, 
      id_bodega_origen, 
      id_bodega_destino, 
      cantidad,
      motivo = 'Transferencia manual',
      referencia
    } = req.body;
    const userId = req.user?.id;

    // Validaciones
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (id_bodega_origen === id_bodega_destino) {
      return res.status(400).json({
        success: false,
        message: 'La bodega origen y destino no pueden ser la misma'
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe ser mayor a 0'
      });
    }

    // Verificar bodegas existen y están activas
    const [bodegaOrigen, bodegaDestino] = await Promise.all([
      Bodega.findOne({ where: { id_bodega: id_bodega_origen, activa: true } }),
      Bodega.findOne({ where: { id_bodega: id_bodega_destino, activa: true } })
    ]);

    if (!bodegaOrigen) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Bodega origen no encontrada o inactiva' });
    }

    if (!bodegaDestino) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Bodega destino no encontrada o inactiva' });
    }

    // Verificar stock en bodega origen
    let stockOrigen = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega: id_bodega_origen },
      transaction
    });

    if (!stockOrigen || stockOrigen.cantidad_disponible < cantidad) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente en ${bodegaOrigen.nombre}. Disponible: ${stockOrigen?.cantidad_disponible || 0}`
      });
    }

    // Buscar o crear stock en bodega destino
    let stockDestino = await StockPorBodega.findOne({
      where: { id_variante_producto, id_bodega: id_bodega_destino },
      transaction
    });

    const stockOrigenAnterior = stockOrigen.cantidad_disponible;
    const stockDestinoAnterior = stockDestino?.cantidad_disponible || 0;

    // Actualizar stock origen (reducir)
    await stockOrigen.update({
      cantidad_disponible: stockOrigenAnterior - cantidad
    }, { transaction });

    // Actualizar o crear stock destino (incrementar)
    if (!stockDestino) {
      stockDestino = await StockPorBodega.create({
        id_variante_producto,
        id_bodega: id_bodega_destino,
        cantidad_disponible: cantidad,
        cantidad_reservada: 0,
        stock_minimo: 0,
        stock_maximo: 0
      }, { transaction });
    } else {
      await stockDestino.update({
        cantidad_disponible: stockDestinoAnterior + cantidad
      }, { transaction });
    }

    // Registrar movimientos (salida origen, entrada destino)
    await Promise.all([
      // Movimiento salida de bodega origen
      registrarMovimientoStock({
        id_variante_producto,
        id_bodega: id_bodega_origen,
        tipo_movimiento: 'transferencia',
        cantidad,
        stock_anterior: stockOrigenAnterior,
        stock_nuevo: stockOrigenAnterior - cantidad,
        motivo: `${motivo} - Salida hacia ${bodegaDestino.nombre}`,
        id_usuario: userId,
        id_bodega_destino,
        referencia
      }),
      // Movimiento entrada a bodega destino
      registrarMovimientoStock({
        id_variante_producto,
        id_bodega: id_bodega_destino,
        tipo_movimiento: 'transferencia',
        cantidad,
        stock_anterior: stockDestinoAnterior,
        stock_nuevo: stockDestinoAnterior + cantidad,
        motivo: `${motivo} - Entrada desde ${bodegaOrigen.nombre}`,
        id_usuario: userId,
        id_bodega_destino: id_bodega_origen, // Bodega origen como referencia
        referencia
      })
    ]);

    await transaction.commit();

    res.json({
      success: true,
      message: 'Transferencia realizada exitosamente',
      data: {
        transferencia: {
          variante_id: id_variante_producto,
          cantidad,
          bodega_origen: { id: id_bodega_origen, nombre: bodegaOrigen.nombre },
          bodega_destino: { id: id_bodega_destino, nombre: bodegaDestino.nombre },
          stock_origen_anterior: stockOrigenAnterior,
          stock_origen_nuevo: stockOrigenAnterior - cantidad,
          stock_destino_anterior: stockDestinoAnterior,
          stock_destino_nuevo: stockDestinoAnterior + cantidad
        }
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error en transferencia:', error);
    next(error);
  }
});

// =======================================================
// POST /stock-bodega/reposicion-auto - Reposición automática
// =======================================================
router.post('/reposicion-auto', async (req: Request, res: Response, next) => {
  try {
    const { id_bodega_destino, forzar_todas = false } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Si se especifica bodega, solo esa; si no, todas las que son punto de venta
    const whereClauseBodega = id_bodega_destino 
      ? { id_bodega: id_bodega_destino, activa: true }
      : { es_punto_venta: true, activa: true };

    // Buscar productos que necesitan reposición
    const productosParaReponer = await StockPorBodega.findAll({
      include: [
        {
          model: Bodega,
          as: 'bodega', // ✅ ALIAS CORRECTO
          where: whereClauseBodega,
          attributes: ['id_bodega', 'nombre', 'codigo']
        },
        {
          model: VarianteProducto,
          as: 'varianteProducto', // ✅ ALIAS CORRECTO
          include: [{
            model: Producto,
            as: 'producto', // ✅ ALIAS CORRECTO
            attributes: ['nombre', 'codigo']
          }]
        }
      ],
      where: forzar_todas 
        ? { stock_minimo: { [Op.gt]: 0 } }
        : sequelize.where(
            sequelize.col('cantidad_disponible'), 
            Op.lt, 
            sequelize.col('stock_minimo')
          )
    });

    if (productosParaReponer.length === 0) {
      return res.json({
        success: true,
        message: 'No hay productos que requieran reposición',
        data: { reposiciones: [] }
      });
    }

    const reposiciones = [];

    for (const stockBajo of productosParaReponer) {
      try {
        // Buscar bodega con mayor stock para este producto
        const bodegaConStock = await StockPorBodega.findOne({
          where: {
            id_variante_producto: stockBajo.id_variante_producto,
            id_bodega: { [Op.ne]: stockBajo.id_bodega },
            cantidad_disponible: { [Op.gt]: 0 }
          },
          include: [{
            model: Bodega,
            as: 'bodega', // ✅ ALIAS CORRECTO
            where: { activa: true },
            attributes: ['id_bodega', 'nombre']
          }],
          order: [['cantidad_disponible', 'DESC']]
        });

        if (!bodegaConStock) {
          reposiciones.push({
            variante_id: stockBajo.id_variante_producto,
            bodega_destino: stockBajo.bodega.nombre,
            status: 'sin_stock_disponible',
            mensaje: 'No hay stock disponible en otras bodegas'
          });
          continue;
        }

        // Calcular cantidad a transferir
        const cantidadNecesaria = stockBajo.stock_maximo > 0 
          ? stockBajo.stock_maximo - stockBajo.cantidad_disponible
          : stockBajo.stock_minimo * 2; // Si no hay máximo, llevar al doble del mínimo

        const cantidadATransferir = Math.min(cantidadNecesaria, bodegaConStock.cantidad_disponible);

        if (cantidadATransferir <= 0) {
          reposiciones.push({
            variante_id: stockBajo.id_variante_producto,
            bodega_destino: stockBajo.bodega.nombre,
            status: 'cantidad_insuficiente',
            mensaje: 'Cantidad insuficiente para transferir'
          });
          continue;
        }

        // Realizar transferencia automática
        const transaccion = await sequelize.transaction();
        
        try {
          // Actualizar stock origen
          await bodegaConStock.update({
            cantidad_disponible: bodegaConStock.cantidad_disponible - cantidadATransferir
          }, { transaction: transaccion });

          // Actualizar stock destino
          await stockBajo.update({
            cantidad_disponible: stockBajo.cantidad_disponible + cantidadATransferir
          }, { transaction: transaccion });

          // Registrar movimientos
          await Promise.all([
            registrarMovimientoStock({
              id_variante_producto: stockBajo.id_variante_producto,
              id_bodega: bodegaConStock.id_bodega,
              tipo_movimiento: 'transferencia',
              cantidad: cantidadATransferir,
              stock_anterior: bodegaConStock.cantidad_disponible + cantidadATransferir,
              stock_nuevo: bodegaConStock.cantidad_disponible,
              motivo: `Reposición automática hacia ${stockBajo.bodega.nombre}`,
              id_usuario: userId,
              id_bodega_destino: stockBajo.id_bodega,
              referencia: `AUTO-REP-${Date.now()}`
            }),
            registrarMovimientoStock({
              id_variante_producto: stockBajo.id_variante_producto,
              id_bodega: stockBajo.id_bodega,
              tipo_movimiento: 'transferencia',
              cantidad: cantidadATransferir,
              stock_anterior: stockBajo.cantidad_disponible - cantidadATransferir,
              stock_nuevo: stockBajo.cantidad_disponible,
              motivo: `Reposición automática desde ${bodegaConStock.bodega.nombre}`,
              id_usuario: userId,
              id_bodega_destino: bodegaConStock.id_bodega,
              referencia: `AUTO-REP-${Date.now()}`
            })
          ]);

          await transaccion.commit();

          reposiciones.push({
            variante_id: stockBajo.id_variante_producto,
            producto: stockBajo.varianteProducto?.producto?.nombre,
            bodega_origen: bodegaConStock.bodega.nombre,
            bodega_destino: stockBajo.bodega.nombre,
            cantidad_transferida: cantidadATransferir,
            stock_anterior: stockBajo.cantidad_disponible - cantidadATransferir,
            stock_nuevo: stockBajo.cantidad_disponible,
            status: 'exitoso'
          });

        } catch (error) {
          await transaccion.rollback();
          reposiciones.push({
            variante_id: stockBajo.id_variante_producto,
            bodega_destino: stockBajo.bodega.nombre,
            status: 'error',
            mensaje: 'Error ejecutando transferencia'
          });
        }

      } catch (error) {
        reposiciones.push({
          variante_id: stockBajo.id_variante_producto,
          status: 'error',
          mensaje: 'Error procesando producto'
        });
      }
    }

    const exitosos = reposiciones.filter(r => r.status === 'exitoso').length;

    res.json({
      success: true,
      message: `Reposición automática completada. ${exitosos}/${reposiciones.length} transferencias exitosas`,
      data: {
        reposiciones,
        resumen: {
          total: reposiciones.length,
          exitosos,
          fallidos: reposiciones.length - exitosos
        }
      }
    });

  } catch (error) {
    console.error('Error en reposición automática:', error);
    next(error);
  }
});

// =======================================================
// GET /stock-bodega/alertas-por-bodega - Alertas específicas por bodega
// =======================================================
router.get('/alertas-por-bodega', async (req: Request, res: Response, next) => {
  try {
    const { id_bodega, solo_punto_venta = false } = req.query;

    const whereClauseBodega: any = { activa: true };
    if (id_bodega) whereClauseBodega.id_bodega = id_bodega;
    if (solo_punto_venta === 'true') whereClauseBodega.es_punto_venta = true;

    const alertasPorBodega = await StockPorBodega.findAll({
      include: [
        {
          model: Bodega,
          as: 'bodega', // ✅ ALIAS CORRECTO
          where: whereClauseBodega,
          attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta']
        },
        {
          model: VarianteProducto,
          as: 'varianteProducto', // ✅ ALIAS CORRECTO
          include: [{
            model: Producto,
            as: 'producto', // ✅ ALIAS CORRECTO
            attributes: ['nombre', 'codigo'],
            where: { activo: true }
          }]
        }
      ],
      where: sequelize.where(
        sequelize.col('cantidad_disponible'), 
        Op.lte, 
        sequelize.col('stock_minimo')
      ),
      order: [
        [{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC'],
        ['cantidad_disponible', 'ASC']
      ]
    });

    // Agrupar por bodega
    const alertasAgrupadas = alertasPorBodega.reduce((acc, stock) => {
      const bodegaId = stock.id_bodega;
      if (!acc[bodegaId]) {
        acc[bodegaId] = {
          bodega: stock.bodega,
          alertas: [],
          resumen: {
            sin_stock: 0,
            bajo_minimo: 0,
            total: 0
          }
        };
      }

      const alerta = {
        ...stock.toJSON(),
        estado_stock: stock.getEstadoStock(),
        porcentaje_stock: stock.getPorcentajeStock(),
        dias_estimados: stock.cantidad_disponible > 0 && stock.stock_minimo > 0
          ? Math.floor((stock.cantidad_disponible / stock.stock_minimo) * 30)
          : 0
      };

      acc[bodegaId].alertas.push(alerta);
      acc[bodegaId].resumen.total++;
      
      if (stock.cantidad_disponible === 0) {
        acc[bodegaId].resumen.sin_stock++;
      } else {
        acc[bodegaId].resumen.bajo_minimo++;
      }

      return acc;
    }, {} as any);

    const alertasArray = Object.values(alertasAgrupadas);

    res.json({
      success: true,
      data: alertasArray,
      resumen_general: {
        bodegas_con_alertas: alertasArray.length,
        total_productos_alerta: alertasPorBodega.length,
        productos_sin_stock: alertasPorBodega.filter(s => s.cantidad_disponible === 0).length,
        productos_bajo_minimo: alertasPorBodega.filter(s => s.cantidad_disponible > 0).length
      }
    });

  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock-bodega/dashboard/:id_bodega - Dashboard específico de bodega
// =======================================================
router.get('/dashboard/:id_bodega', async (req: Request, res: Response, next) => {
  try {
    const { id_bodega } = req.params;

    // Verificar que la bodega existe
    const bodega = await Bodega.findByPk(id_bodega);
    if (!bodega) {
      return res.status(404).json({ success: false, message: 'Bodega no encontrada' });
    }

    // Stock actual de la bodega
    const stockActual = await StockPorBodega.findAll({
      where: { id_bodega },
      include: [{
        model: VarianteProducto,
        as: 'varianteProducto', // ✅ ALIAS CORRECTO
        include: [{
          model: Producto,
          as: 'producto', // ✅ ALIAS CORRECTO
          attributes: ['nombre', 'codigo', 'precio_costo_base'],
          where: { activo: true }
        }]
      }]
    });

    // Movimientos recientes (últimos 30 días)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 30);

    const movimientosRecientes = await MovimientoStock.findAll({
      where: {
        id_bodega,
        fecha_movimiento: { [Op.gte]: fechaLimite }
      },
      include: [
        {
          model: VarianteProducto,
          as: 'varianteProducto', // ✅ ALIAS CORRECTO
          include: [{ 
            model: Producto, 
            as: 'producto', // ✅ ALIAS CORRECTO
            attributes: ['nombre', 'codigo'] 
          }]
        },
        { 
          model: Usuario, 
          as: 'usuario', // ✅ ALIAS CORRECTO
          attributes: ['nombre'] 
        },
        { 
          model: Bodega, 
          as: 'bodegaDestino', // ✅ ALIAS CORRECTO
          attributes: ['nombre'], 
          required: false 
        }
      ],
      order: [['fecha_movimiento', 'DESC']],
      limit: 50
    });

    // Calcular métricas
    const metricas = {
      total_productos: stockActual.length,
      productos_con_stock: stockActual.filter(s => s.cantidad_disponible > 0).length,
      productos_sin_stock: stockActual.filter(s => s.cantidad_disponible === 0).length,
      productos_bajo_minimo: stockActual.filter(s => s.estaPorDebajoDelMinimo()).length,
      valor_total_inventario: stockActual.reduce((total, stock) => {
        const precio = stock.varianteProducto?.producto?.precio_costo_base || 0;
        return total + (stock.cantidad_disponible * precio);
      }, 0),
      stock_total_disponible: stockActual.reduce((total, s) => total + s.cantidad_disponible, 0),
      stock_total_reservado: stockActual.reduce((total, s) => total + s.cantidad_reservada, 0)
    };

    // Top productos por cantidad
    const topProductos = stockActual
      .sort((a, b) => b.cantidad_disponible - a.cantidad_disponible)
      .slice(0, 10)
      .map(stock => ({
        producto: stock.varianteProducto?.producto?.nombre,
        codigo: stock.varianteProducto?.producto?.codigo,
        cantidad: stock.cantidad_disponible,
        valor: stock.cantidad_disponible * (stock.varianteProducto?.producto?.precio_costo_base || 0)
      }));

    res.json({
      success: true,
      data: {
        bodega,
        metricas,
        top_productos: topProductos,
        movimientos_recientes: movimientosRecientes,
        alertas: stockActual.filter(s => s.estaPorDebajoDelMinimo()).map(stock => ({
          ...stock.toJSON(),
          estado_stock: stock.getEstadoStock(),
          porcentaje_stock: stock.getPorcentajeStock()
        }))
      }
    });

  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock-bodega/disponibilidad/:id_variante - Consultar disponibilidad en todas las bodegas
// =======================================================
router.get('/disponibilidad/:id_variante', async (req: Request, res: Response, next) => {
  try {
    const { id_variante } = req.params;
    const { incluir_inactivas = false } = req.query;

    const whereClauseBodega: any = {};
    if (incluir_inactivas !== 'true') {
      whereClauseBodega.activa = true;
    }
    

    const disponibilidad = await StockPorBodega.findAll({
      where: { id_variante_producto: id_variante },
      include: [{
        model: Bodega,
        as: 'bodega', // ✅ ALIAS CORRECTO
        where: whereClauseBodega,
        attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta', 'activa']
      }],
      order: [
        [{ model: Bodega, as: 'bodega' }, 'es_punto_venta', 'DESC'],
        [{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']
      ]
    });

    const stockTotal = disponibilidad.reduce((total, stock) => total + stock.cantidad_disponible, 0);
    const stockReservado = disponibilidad.reduce((total, stock) => total + stock.cantidad_reservada, 0);

    const bodegasConStock = disponibilidad.filter(stock => stock.cantidad_disponible > 0);
    const bodegasSinStock = disponibilidad.filter(stock => stock.cantidad_disponible === 0);

    const configuracion = {
      permite_venta_sin_stock: false,                     // ← regla de negocio
      bodega_sugerida: bodegasConStock[0]?.id_bodega ?? null,
      motivo_sugerencia: bodegasConStock[0] 
         ? `Stock óptimo en ${bodegasConStock[0].bodega.nombre}` 
         : 'Sin stock disponible'
    };

// 2️⃣  Convierte el array que ya tienes al formato esperado
const por_bodega = disponibilidad.map(s => ({
  bodega_id: s.id_bodega,
  nombre: s.bodega.nombre,
  es_punto_venta: s.bodega.es_punto_venta,
  cantidad_disponible: s.cantidad_disponible,
  cantidad_reservada: s.cantidad_reservada,
  estado_stock: s.getEstadoStock(),
  puede_vender_desde_aqui: s.tieneDisponibilidad(1)
}));



res.json({
  success: true,
  data: {
    configuracion,
    por_bodega,
    disponibilidad: {
      total_sistema     : stockTotal + stockReservado,
      total_disponible  : stockTotal,
      total_reservado   : stockReservado,
      puede_vender      : stockTotal > 0 || configuracion.permite_venta_sin_stock,
      cantidad_maxima_venta : stockTotal                           // ajusta a tu lógica
    },
    alertas: por_bodega
      .filter(b => b.estado_stock !== 'normal')
      .map(b => `${b.nombre}: ${b.estado_stock}`)
  }
});

  

  } catch (error) {
    next(error);
  }
});

export default router;