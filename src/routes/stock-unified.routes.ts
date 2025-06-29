// src/routes/stock-unified.routes.ts - NUEVA API MODERNA
import { Router, Request, Response } from 'express';
import { auth } from '../middlewares/auth';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { Producto } from '../models/Producto.model';
import { Bodega } from '../models/Bodega.model';
import { sequelize } from '../config/database';
import { Op, Transaction } from 'sequelize';

const router = Router();
router.use(auth);

// ✅ INTERFAZ MODERNA PARA DISPONIBILIDAD UNIFICADA
interface DisponibilidadUnificada {
  variante_id: number;
  producto: {
    nombre: string;
    codigo: string;
    unidad_medida: string;
  };
  variante: {
    sku: string;
    descripcion: string;
  };
  disponibilidad: {
    total_sistema: number;
    total_disponible: number;
    total_reservado: number;
    puede_vender: boolean;
    cantidad_maxima_venta: number;
  };
  por_bodega: {
    bodega_id: number;
    nombre: string;
    es_punto_venta: boolean;
    cantidad_disponible: number;
    cantidad_reservada: number;
    estado_stock: 'sin_stock' | 'bajo_minimo' | 'normal' | 'sobre_maximo';
    puede_vender_desde_aqui: boolean;
  }[];
  configuracion: {
    permite_venta_sin_stock: boolean;
    bodega_sugerida?: number;
    motivo_sugerencia?: string;
  };
  alertas?: string[];
}

/**
 * @openapi
 * /stock-unified/disponibilidad/{varianteId}:
 *   get:
 *     summary: Obtener disponibilidad unificada de una variante
 *     description: Devuelve stock total + detalle por bodega + configuración de venta
 */
router.get('/disponibilidad/:varianteId', async (req: Request, res: Response) => {
  try {
    const { varianteId } = req.params;
    const { para_venta = 'true', incluir_inactivas = 'false' } = req.query;

    // 1. Obtener variante con producto
    const variante = await VarianteProducto.findByPk(varianteId, {
      include: [{
        model: Producto,
        as: 'producto',
        attributes: ['nombre', 'codigo', 'unidad_medida']
      }]
    });

    if (!variante) {
      return res.status(404).json({
        success: false,
        message: 'Variante no encontrada'
      });
    }

    // 2. Obtener stock por bodega
    const whereClauseBodega: any = {};
    if (incluir_inactivas !== 'true') {
      whereClauseBodega.activa = true;
    }
    if (para_venta === 'true') {
      whereClauseBodega.es_punto_venta = true;
    }

    const stockPorBodega = await StockPorBodega.findAll({
      where: { id_variante_producto: varianteId },
      include: [{
        model: Bodega,
        as: 'bodega',
        where: whereClauseBodega,
        attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta', 'activa']
      }],
      order: [
        [{ model: Bodega, as: 'bodega' }, 'es_punto_venta', 'DESC'],
        [{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']
      ]
    });

    // 3. Calcular totales
    const totalDisponible = stockPorBodega.reduce((sum, stock) => 
      sum + Number(stock.cantidad_disponible), 0
    );
    const totalReservado = stockPorBodega.reduce((sum, stock) => 
      sum + Number(stock.cantidad_reservada), 0
    );

    // 4. Configuración de venta (placeholder - implementar según negocio)
    const configuracion = await obtenerConfiguracionVenta();
    
    // 5. Determinar bodega sugerida para venta
    const bodegaSugerida = determinarBodegaSugerida(stockPorBodega, configuracion);

    // 6. Generar alertas
    const alertas = generarAlertas(stockPorBodega, totalDisponible, configuracion);

    // 7. Formatear respuesta
    const disponibilidad: DisponibilidadUnificada = {
      variante_id: Number(varianteId),
      producto: {
        nombre: variante.producto?.nombre || 'Producto sin nombre',
        codigo: variante.producto?.codigo || '',
        unidad_medida: variante.producto?.unidad_medida || 'unidad'
      },
      variante: {
        sku: variante.sku,
        descripcion: variante.getDescripcionCompleta()
      },
      disponibilidad: {
        total_sistema: totalDisponible + totalReservado,
        total_disponible: totalDisponible,
        total_reservado: totalReservado,
        puede_vender: totalDisponible > 0 || configuracion.permite_venta_sin_stock,
        cantidad_maxima_venta: configuracion.permite_venta_sin_stock ? 999999 : totalDisponible
      },
      por_bodega: stockPorBodega.map(stock => ({
        bodega_id: stock.id_bodega,
        nombre: stock.bodega.nombre,
        es_punto_venta: stock.bodega.es_punto_venta,
        cantidad_disponible: Number(stock.cantidad_disponible),
        cantidad_reservada: Number(stock.cantidad_reservada),
        estado_stock: stock.getEstadoStock(),
        puede_vender_desde_aqui: Number(stock.cantidad_disponible) > 0 || configuracion.permite_venta_sin_stock
      })),
      configuracion: {
        permite_venta_sin_stock: configuracion.permite_venta_sin_stock,
        bodega_sugerida: bodegaSugerida?.bodega_id,
        motivo_sugerencia: bodegaSugerida?.motivo
      },
      alertas
    };

    res.json({
      success: true,
      data: disponibilidad
    });

  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @openapi
 * /stock-unified/reservar:
 *   post:
 *     summary: Crear reserva temporal para proceso de venta
 */
router.post('/reservar', async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { items, motivo = 'Vale de venta', duracion_minutos = 30, referencia } = req.body;
    const userId = (req as any).user?.id;

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un array de items para reservar'
      });
    }

    const reservasCreadas = [];
    const configuracion = await obtenerConfiguracionVenta();

    for (const item of items) {
      const { id_variante_producto, cantidad, bodega_preferida } = item;
      
      // Validar cantidad
      if (!cantidad || cantidad <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cantidad inválida para variante ${id_variante_producto}`
        });
      }

      // Obtener disponibilidad actual
      const stockDisponible = await StockPorBodega.findAll({
        where: { id_variante_producto },
        include: [{
          model: Bodega,
          as: 'bodega',
          where: { activa: true, es_punto_venta: true }
        }],
        transaction
      });

      // Determinar desde qué bodega reservar
      let bodegaSeleccionada = null;
      if (bodega_preferida) {
        bodegaSeleccionada = stockDisponible.find(s => s.id_bodega === bodega_preferida);
      }
      
      if (!bodegaSeleccionada) {
        // Usar bodega con más stock disponible
        bodegaSeleccionada = stockDisponible
          .filter(s => s.cantidad_disponible >= cantidad)
          .sort((a, b) => b.cantidad_disponible - a.cantidad_disponible)[0];
      }

      // Validar si se puede reservar
      if (!bodegaSeleccionada || bodegaSeleccionada.cantidad_disponible < cantidad) {
        if (!configuracion.permite_venta_sin_stock) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para variante ${id_variante_producto}. Disponible: ${stockDisponible.reduce((sum, s) => sum + s.cantidad_disponible, 0)}`
          });
        }
        // Si permite venta sin stock, crear reserva en bodega principal
        bodegaSeleccionada = stockDisponible[0] || await crearStockVirtual(id_variante_producto, transaction);
      }

      // Crear la reserva actualizando stock
      await bodegaSeleccionada.update({
        cantidad_disponible: Math.max(0, bodegaSeleccionada.cantidad_disponible - cantidad),
        cantidad_reservada: bodegaSeleccionada.cantidad_reservada + cantidad
      }, { transaction });

      // Registrar movimiento
      await registrarMovimientoStock({
        id_variante_producto,
        id_bodega: bodegaSeleccionada.id_bodega,
        tipo_movimiento: 'ajuste',
        cantidad: -cantidad,
        stock_anterior: bodegaSeleccionada.cantidad_disponible + cantidad,
        stock_nuevo: bodegaSeleccionada.cantidad_disponible,
        motivo: `Reserva temporal: ${motivo}`,
        id_usuario: userId,
        referencia: referencia || `RESERVA-${Date.now()}`
      }, transaction);

      reservasCreadas.push({
        id_variante_producto,
        cantidad,
        bodega_id: bodegaSeleccionada.id_bodega,
        bodega_nombre: bodegaSeleccionada.bodega.nombre
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        reservas: reservasCreadas,
        expires_at: new Date(Date.now() + duracion_minutos * 60000),
        referencia: referencia || `RESERVA-${Date.now()}`
      },
      message: `Se reservaron ${reservasCreadas.length} productos exitosamente`
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creando reserva:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando reserva temporal'
    });
  }
});

/**
 * @openapi
 * /stock-unified/actualizar/{varianteId}:
 *   put:
 *     summary: Actualizar stock específico por bodega (NUEVO)
 */
router.put('/actualizar/:varianteId', async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { varianteId } = req.params;
    const { bodega_id, cantidad, motivo = 'Ajuste manual', tipo = 'ajuste' } = req.body;
    const userId = (req as any).user?.id;

    if (!bodega_id || cantidad === undefined) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'bodega_id y cantidad son requeridos'
      });
    }

    // Obtener stock actual
    const stock = await StockPorBodega.findOne({
      where: { 
        id_variante_producto: varianteId, 
        id_bodega: bodega_id 
      },
      include: [{
        model: Bodega,
        as: 'bodega',
        attributes: ['nombre']
      }],
      transaction
    });

    if (!stock) {
      // Crear nuevo registro de stock si no existe
      const nuevoStock = await StockPorBodega.create({
        id_variante_producto: varianteId,
        id_bodega: bodega_id,
        cantidad_disponible: Math.max(0, cantidad),
        cantidad_reservada: 0,
        stock_minimo: 0,
        stock_maximo: 0
      }, { transaction });

      await registrarMovimientoStock({
        id_variante_producto: Number(varianteId),
        id_bodega: bodega_id,
        tipo_movimiento: tipo as any,
        cantidad: cantidad,
        stock_anterior: 0,
        stock_nuevo: cantidad,
        motivo,
        id_usuario: userId,
        referencia: `MANUAL-${Date.now()}`
      }, transaction);

      await transaction.commit();

      return res.json({
        success: true,
        data: {
          variante_id: varianteId,
          bodega_id: bodega_id,
          cantidad_anterior: 0,
          cantidad_nueva: cantidad,
          diferencia: cantidad
        },
        message: 'Stock creado y actualizado exitosamente'
      });
    }

    // Actualizar stock existente
    const stockAnterior = stock.cantidad_disponible;
    const diferencia = cantidad - stockAnterior;

    await stock.update({
      cantidad_disponible: Math.max(0, cantidad),
      fecha_actualizacion: new Date()
    }, { transaction });

    // Registrar movimiento
    await registrarMovimientoStock({
      id_variante_producto: Number(varianteId),
      id_bodega: bodega_id,
      tipo_movimiento: tipo as any,
      cantidad: Math.abs(diferencia),
      stock_anterior: stockAnterior,
      stock_nuevo: cantidad,
      motivo,
      id_usuario: userId,
      referencia: `MANUAL-${Date.now()}`
    }, transaction);

    await transaction.commit();

    res.json({
      success: true,
      data: {
        variante_id: varianteId,
        bodega_id: bodega_id,
        bodega_nombre: stock.bodega.nombre,
        cantidad_anterior: stockAnterior,
        cantidad_nueva: cantidad,
        diferencia: diferencia,
        tipo_movimiento: diferencia > 0 ? 'entrada' : 'salida'
      },
      message: `Stock actualizado exitosamente en ${stock.bodega.nombre}`
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error actualizando stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando stock'
    });
  }
});

// =================== FUNCIONES HELPER ===================

async function obtenerConfiguracionVenta() {
  // TODO: Implementar tabla de configuración del sistema
  // Por ahora retornar configuración por defecto
  return {
    permite_venta_sin_stock: false,
    auto_asignar_bodega: true,
    prioridad_bodega: 'mayor_stock' as 'mayor_stock' | 'mas_cercana' | 'fifo',
    reserva_temporal_minutos: 30
  };
}

function determinarBodegaSugerida(stockPorBodega: any[], configuracion: any) {
  if (!configuracion.auto_asignar_bodega) return null;

  const bodegasConStock = stockPorBodega.filter(s => s.cantidad_disponible > 0);
  
  if (bodegasConStock.length === 0) {
    // Sin stock, sugerir bodega principal (primera)
    return stockPorBodega.length > 0 ? {
      bodega_id: stockPorBodega[0].id_bodega,
      motivo: 'Bodega principal (sin stock disponible)'
    } : null;
  }

  // Sugerir bodega con mayor stock
  const bodegaConMayorStock = bodegasConStock
    .sort((a, b) => b.cantidad_disponible - a.cantidad_disponible)[0];

  return {
    bodega_id: bodegaConMayorStock.id_bodega,
    motivo: `Mayor stock disponible (${bodegaConMayorStock.cantidad_disponible})`
  };
}

function generarAlertas(stockPorBodega: any[], totalDisponible: number, configuracion: any): string[] {
  const alertas = [];

  if (totalDisponible === 0) {
    if (configuracion.permite_venta_sin_stock) {
      alertas.push('⚠️ Sin stock disponible - Venta sin stock habilitada');
    } else {
      alertas.push('❌ Sin stock disponible - No se puede vender');
    }
  }

  const bodegasBajoMinimo = stockPorBodega.filter(s => s.estaPorDebajoDelMinimo());
  if (bodegasBajoMinimo.length > 0) {
    alertas.push(`📉 ${bodegasBajoMinimo.length} bodega(s) bajo stock mínimo`);
  }

  return alertas;
}

async function registrarMovimientoStock(data: any, transaction: Transaction) {
  const { MovimientoStock } = require('../models/MovimientoStock.model');
  return await MovimientoStock.create({
    ...data,
    fecha_movimiento: new Date()
  }, { transaction });
}

async function crearStockVirtual(varianteId: number, transaction: Transaction) {
  // Crear stock en bodega principal para venta sin stock
  const bodegaPrincipal = await Bodega.findOne({
    where: { es_punto_venta: true, activa: true },
    transaction
  });

  if (!bodegaPrincipal) {
    throw new Error('No se encontró bodega principal activa');
  }

  return await StockPorBodega.create({
    id_variante_producto: varianteId,
    id_bodega: bodegaPrincipal.id_bodega,
    cantidad_disponible: 0,
    cantidad_reservada: 0,
    stock_minimo: 0,
    stock_maximo: 0
  }, { transaction });
}

export default router;