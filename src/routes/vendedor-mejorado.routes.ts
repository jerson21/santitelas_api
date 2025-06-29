// src/routes/vendedor-mejorado.routes.ts - VERSIÓN CORREGIDA
import { Router, Request, Response } from 'express';
import { auth } from '../middlewares/auth';
import { sequelize } from '../config/database';
import { QueryTypes } from 'sequelize';

// ✅ IMPORTACIONES CORREGIDAS
import { ConfiguracionService } from '../models/ConfiguracionSistema.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Pedido } from '../models/Pedido.model';
import { DetallePedido } from '../models/DetallePedido.model';
import { Bodega } from '../models/Bodega.model';
import { MovimientoStock } from '../models/MovimientoStock.model';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /vendedor/pedido-rapido-v2:
 *   post:
 *     summary: Crear vale con validación y reserva de stock (MEJORADO)
 */
router.post('/pedido-rapido-v2', async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { tipo_documento, detalles, cliente } = req.body;
    const vendedorId = (req as any).user?.id;

    // 1. Obtener configuración del sistema
    const configVenta = await ConfiguracionService.getConfigVenta();
    const configStock = await ConfiguracionService.getConfigStock();

    console.log('🔧 Configuración activa:', { configVenta, configStock });

    // 2. Validaciones básicas (sin cambios)
    if (!tipo_documento || !Array.isArray(detalles) || detalles.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento y lista de detalles son requeridos.'
      });
    }

    // 3. NUEVA VALIDACIÓN: Verificar disponibilidad de stock
    const validacionStock = await validarDisponibilidadCompleta(detalles, configStock, transaction);
    
    if (!validacionStock.puede_proceder) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Problemas de stock detectados',
        errores_stock: validacionStock.errores,
        sugerencias: validacionStock.sugerencias
      });
    }

    // 4. Generar número de pedido
    const [resultado]: any = await sequelize.query(
      'SELECT generar_numero_pedido_simple() as numero_completo, obtener_proximo_numero_diario() as numero_diario',
      { type: QueryTypes.SELECT, transaction }
    );

    // 5. Calcular fecha límite de reserva
    const fechaLimiteReserva = new Date();
    fechaLimiteReserva.setMinutes(fechaLimiteReserva.getMinutes() + configVenta.timeout_vale_minutos);

    // 6. Crear pedido
    const nuevoPedido = await Pedido.create({
      numero_pedido: resultado.numero_completo,
      numero_diario: resultado.numero_diario,
      id_vendedor: vendedorId,
      id_cliente: cliente?.id || null,
      tipo_documento,
      estado: 'vale_pendiente',
      subtotal: validacionStock.subtotal_calculado,
      total: validacionStock.subtotal_calculado,
      datos_completos: tipo_documento !== 'factura' || (cliente && cliente.datos_completos),
      observaciones: `Vale con reserva temporal creado por ${(req as any).user?.username}`,
      fecha_limite_reserva: fechaLimiteReserva
    }, { transaction });

    // 7. NUEVA FUNCIONALIDAD: Crear reservas temporales de stock
    const reservasCreadas = [];
    if (configVenta.crear_reserva_temporal) {
      for (const asignacion of validacionStock.asignaciones_bodega) {
        const stock = await StockPorBodega.findOne({
          where: {
            id_variante_producto: asignacion.id_variante_producto,
            id_bodega: asignacion.bodega_id
          },
          transaction
        });

        if (stock) {
          // Actualizar stock: mover de disponible a reservado
          await stock.update({
            cantidad_disponible: Math.max(0, stock.cantidad_disponible - asignacion.cantidad),
            cantidad_reservada: stock.cantidad_reservada + asignacion.cantidad
          }, { transaction });

          reservasCreadas.push({
            variante_id: asignacion.id_variante_producto,
            bodega_id: asignacion.bodega_id,
            cantidad: asignacion.cantidad
          });

          // Registrar movimiento
          await registrarMovimientoStock({
            id_variante_producto: asignacion.id_variante_producto,
            id_bodega: asignacion.bodega_id,
            tipo_movimiento: 'ajuste',
            cantidad: -asignacion.cantidad,
            stock_anterior: stock.cantidad_disponible + asignacion.cantidad,
            stock_nuevo: stock.cantidad_disponible,
            motivo: `Reserva temporal - Vale ${resultado.numero_completo}`,
            id_usuario: vendedorId,
            referencia: `VALE-${resultado.numero_completo}`
          }, transaction);
        }
      }
    }

    // 8. Crear detalles del pedido con información de bodega
    const detallesCreados = [];
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      const asignacion = validacionStock.asignaciones_bodega.find(
        a => a.index_detalle === i
      );

      const detalleCreado = await DetallePedido.create({
        id_pedido: nuevoPedido.id_pedido,
        id_variante_producto: detalle.id_variante_producto,
        id_modalidad: detalle.id_modalidad,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: Math.round(detalle.cantidad * detalle.precio_unitario),
        observaciones: detalle.observaciones || '',
        // ✅ USAR EL NUEVO CAMPO id_bodega
        id_bodega: asignacion?.bodega_id || null
      }, { transaction });

      detallesCreados.push(detalleCreado);
    }

    await transaction.commit();

    // 9. Programar liberación automática de reserva
    if (configVenta.crear_reserva_temporal) {
      programarLiberacionReserva(nuevoPedido.id_pedido, configVenta.timeout_vale_minutos);
    }

    res.status(201).json({
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
        fecha_limite_reserva: nuevoPedido.fecha_limite_reserva,
        // ✅ NUEVA INFO: Detalles de reserva
        reserva_info: {
          reservas_creadas: reservasCreadas.length,
          duracion_minutos: configVenta.timeout_vale_minutos,
          libera_automaticamente: true
        },
        validacion_stock: {
          todas_disponibles: validacionStock.todas_disponibles,
          requiere_venta_sin_stock: validacionStock.requiere_venta_sin_stock,
          bodegas_utilizadas: [...new Set(validacionStock.asignaciones_bodega.map(a => a.bodega_id))]
        }
      },
      message: `Vale #${nuevoPedido.numero_diario} creado con reserva temporal`,
      alertas: validacionStock.todas_disponibles ? [] : [
        '⚠️ Algunos productos no tienen stock suficiente',
        'Se procesará como venta sin stock según configuración'
      ]
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error creando vale mejorado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al procesar el vale'
    });
  }
});

// =====================================================================
// FUNCIONES HELPER PARA EL NUEVO SISTEMA
// =====================================================================

async function validarDisponibilidadCompleta(detalles: any[], configStock: any, transaction: any) {
  const errores = [];
  const sugerencias = [];
  const asignaciones_bodega = [];
  let subtotal_calculado = 0;
  let todas_disponibles = true;
  let requiere_venta_sin_stock = false;

  for (let i = 0; i < detalles.length; i++) {
    const detalle = detalles[i];
    
    // Obtener stock disponible por bodega
    const stockDisponible = await StockPorBodega.findAll({
      where: { id_variante_producto: detalle.id_variante_producto },
      include: [{
        model: Bodega,
        as: 'bodega',
        where: { activa: true, es_punto_venta: true }
      }],
      transaction
    });

    const stockTotal = stockDisponible.reduce((sum, s) => sum + Number(s.cantidad_disponible), 0);

    // Determinar bodega según configuración
    let bodegaAsignada = null;
    let stockDisponibleEnBodega = 0;

    if (configStock.auto_asignar_bodega) {
      switch (configStock.prioridad_bodega) {
        case 'mayor_stock':
          bodegaAsignada = stockDisponible
            .sort((a, b) => Number(b.cantidad_disponible) - Number(a.cantidad_disponible))[0];
          break;
        case 'fifo':
          bodegaAsignada = stockDisponible
            .sort((a, b) => new Date(a.fecha_actualizacion).getTime() - new Date(b.fecha_actualizacion).getTime())[0];
          break;
        default:
          bodegaAsignada = stockDisponible[0]; // Primera disponible
      }
    } else {
      bodegaAsignada = stockDisponible[0]; // Requerir selección manual en frontend
    }

    if (bodegaAsignada) {
      stockDisponibleEnBodega = Number(bodegaAsignada.cantidad_disponible);
    }

    // Validar disponibilidad
    const cantidadSolicitada = Number(detalle.cantidad);
    const esVentaSinStock = cantidadSolicitada > stockDisponibleEnBodega;

    if (esVentaSinStock) {
      todas_disponibles = false;
      requiere_venta_sin_stock = true;

      if (!configStock.permite_venta_sin_stock) {
        errores.push({
          index: i,
          variante_id: detalle.id_variante_producto,
          mensaje: `Stock insuficiente. Solicitado: ${cantidadSolicitada}, Disponible: ${stockTotal}`,
          stock_disponible: stockTotal,
          cantidad_solicitada: cantidadSolicitada
        });
        continue;
      } else {
        sugerencias.push({
          index: i,
          mensaje: `Producto se venderá sin stock completo (Faltante: ${cantidadSolicitada - stockDisponibleEnBodega})`
        });
      }
    }

    // Registrar asignación
    asignaciones_bodega.push({
      index_detalle: i,
      id_variante_producto: detalle.id_variante_producto,
      cantidad: cantidadSolicitada,
      bodega_id: bodegaAsignada?.id_bodega || null,
      stock_disponible: stockDisponibleEnBodega,
      es_venta_sin_stock: esVentaSinStock
    });

    subtotal_calculado += detalle.cantidad * detalle.precio_unitario;
  }

  return {
    puede_proceder: errores.length === 0,
    todas_disponibles,
    requiere_venta_sin_stock,
    errores,
    sugerencias,
    asignaciones_bodega,
    subtotal_calculado
  };
}

async function registrarMovimientoStock(data: any, transaction: any) {
  return await MovimientoStock.create({
    ...data,
    fecha_movimiento: new Date()
  }, { transaction });
}

function programarLiberacionReserva(pedidoId: number, minutos: number) {
  setTimeout(async () => {
    try {
      await liberarReservaAutomatica(pedidoId);
    } catch (error) {
      console.error(`Error liberando reserva automática para pedido ${pedidoId}:`, error);
    }
  }, minutos * 60 * 1000);
}

async function liberarReservaAutomatica(pedidoId: number) {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar si el vale sigue pendiente
    const pedido = await Pedido.findByPk(pedidoId, { transaction });
    
    if (!pedido || pedido.estado !== 'vale_pendiente') {
      await transaction.commit();
      return; // Ya fue procesado
    }

    // Verificar si ya expiró
    if (pedido.fecha_limite_reserva && new Date() < new Date(pedido.fecha_limite_reserva)) {
      await transaction.commit();
      return; // Aún no expira
    }

    // Liberar reservas usando el campo id_bodega
    const detalles = await DetallePedido.findAll({
      where: { id_pedido: pedidoId },
      transaction
    });

    for (const detalle of detalles) {
      if (detalle.id_bodega) {
        const stock = await StockPorBodega.findOne({
          where: {
            id_variante_producto: detalle.id_variante_producto,
            id_bodega: detalle.id_bodega
          },
          transaction
        });

        if (stock) {
          await stock.update({
            cantidad_disponible: Number(stock.cantidad_disponible) + Number(detalle.cantidad),
            cantidad_reservada: Math.max(0, Number(stock.cantidad_reservada) - Number(detalle.cantidad))
          }, { transaction });
        }
      }
    }

    // Marcar vale como cancelado
    await pedido.update({
      estado: 'cancelado',
      observaciones: `${pedido.observaciones}\n[RESERVA LIBERADA AUTOMÁTICAMENTE - ${new Date().toLocaleString('es-CL')}]`
    }, { transaction });

    await transaction.commit();
    console.log(`✅ Reserva liberada automáticamente para vale ${pedido.numero_pedido}`);

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export default router;