import { Router, Request, Response, NextFunction } from 'express';

import { auth } from '../middlewares/auth';
import { Pedido } from '../models/Pedido.model';
import { DetallePedido } from '../models/DetallePedido.model';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { Usuario } from '../models/Usuario.model';
import { Cliente } from '../models/Cliente.model';
import { Venta } from '../models/Venta.model';
import { TipoDocumento } from '../models/TipoDocumento.model';
import { TurnoCaja } from '../models/TurnoCaja.model';
import { ArqueoCaja } from '../models/ArqueoCaja.model';
import { Pago } from '../models/Pago.model';
import { Caja } from '../models/Caja.model';

import { MetodoPago } from '../models/MetodoPago.model';
import { Op, Transaction, QueryTypes, Sequelize  } from 'sequelize';
import { sequelize } from '../config/database';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();
router.use(auth);

// --- Tipos auxiliares ---
interface Alerta {
  tipo: 'warning' | 'info' | 'error';
  mensaje: string;
  detalle?: string;
  valor?: number;
}
interface Recomendacion {
  tipo?: 'mejora' | 'control';
  prioridad?: 'alta' | 'media' | 'baja';
  mensaje: string;
  razon?: string;
}
type Prioridad = 'alta' | 'media' | 'normal';

// ✅ INTERFACES PARA TIPADO CORRECTO
interface ValeDelDia {
  id_pedido: number;
  numero_pedido: string;
  numero_diario: number;
  fecha_creacion: string;
  fecha_vale: string;
  hora_vale?: string;
  estado: string;
  total: number;
  dias_atras?: number;
}

interface ResultadoBusqueda {
  encontrado: boolean;
  esValeAntiguo: boolean;
  numero_pedido?: string;
  diasAtras?: number;
  mensaje?: string;
}

// --- Middleware validación Express Validator (con error 422 si corresponde) ---
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

// ✅ ======================================================================
// ✅ NUEVA FUNCIÓN HELPER MEJORADA PARA BUSCAR VALES
// ✅ ======================================================================
async function buscarValePorNumero(numeroVale: string, transaction?: any): Promise<ResultadoBusqueda> {
  console.log(`🔍 Iniciando búsqueda de vale: "${numeroVale}"`);
  
  // Detectar tipo de búsqueda
  const esNumeroSimple = /^\d{1,4}$/.test(numeroVale);
  
  if (esNumeroSimple) {
    const numeroDiario = parseInt(numeroVale);
    console.log(`🔢 Búsqueda por número diario: ${numeroDiario}`);
    
    // ✅ USAR SQL RAW PARA BÚSQUEDA POR FECHA + NUMERO_DIARIO - CON TIPADO CORRECTO
    const resultados = await sequelize.query(`
      SELECT id_pedido, numero_pedido, numero_diario, estado, 
             DATE(fecha_creacion) as fecha_vale, fecha_creacion
      FROM pedidos 
      WHERE numero_diario = :numeroDiario 
        AND DATE(fecha_creacion) = CURDATE()
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `, {
      replacements: { numeroDiario },
      type: QueryTypes.SELECT,
      transaction
    }) as ValeDelDia[];
    
    console.log(`📊 Resultados búsqueda SQL raw:`, resultados);
    
    if (resultados.length === 0) {
      console.log(`❌ No se encontró vale ${numeroDiario} en el día actual`);
      
      // 🔍 BÚSQUEDA AMPLIADA: Últimos 7 días - CON TIPADO CORRECTO
      console.log(`🔍 Ampliando búsqueda a últimos 7 días...`);
      const resultadosAmpliados = await sequelize.query(`
        SELECT id_pedido, numero_pedido, numero_diario, estado,
               DATE(fecha_creacion) as fecha_vale, fecha_creacion,
               DATEDIFF(CURDATE(), DATE(fecha_creacion)) as dias_atras
        FROM pedidos 
        WHERE numero_diario = :numeroDiario 
          AND fecha_creacion >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY fecha_creacion DESC
        LIMIT 5
      `, {
        replacements: { numeroDiario },
        type: QueryTypes.SELECT,
        transaction
      }) as ValeDelDia[];
      
      console.log(`📊 Vales encontrados en últimos 7 días:`, resultadosAmpliados);
      
      if (resultadosAmpliados.length > 0) {
        const vale = resultadosAmpliados[0];
        console.log(`⚠️ Vale encontrado pero de hace ${vale.dias_atras} días. ¿Continuar?`);
        return {
          encontrado: true,
          esValeAntiguo: true,
          diasAtras: vale.dias_atras,
          numero_pedido: vale.numero_pedido
        };
      }
      
      return { 
        encontrado: false, 
        esValeAntiguo: false,
        mensaje: `Vale #${numeroDiario} no encontrado` 
      };
    }
    
    const vale = resultados[0];
    console.log(`✅ Vale encontrado: ${vale.numero_pedido} del día ${vale.fecha_vale}`);
    return { 
      encontrado: true, 
      esValeAntiguo: false,
      numero_pedido: vale.numero_pedido 
    };
    
  } else {
    // Búsqueda por número completo
    console.log(`📄 Búsqueda por número completo: ${numeroVale}`);
    return { 
      encontrado: true, 
      esValeAntiguo: false,
      numero_pedido: numeroVale 
    };
  }
}

// --- Helper: generar número de venta seguro ---
async function generarNumeroVenta(transaction?: Transaction): Promise<string> {
  const año = new Date().getFullYear();
  try {
    const resultados = await sequelize.query(
      'SELECT generar_numero_venta() as numero',
      { transaction }
    ) as any[];
    return resultados[0]?.[0]?.numero || `${año}0101-0001`;
  } catch (error) {
    const ultimaVenta = await Venta.findOne({
      where: {
        numero_venta: { [Op.like]: `${año}%` }
      },
      order: [['numero_venta', 'DESC']],
      transaction
    });
    let numeroSecuencial = 1;
    if (ultimaVenta) {
      const match = ultimaVenta.numero_venta.match(/-(\d+)$/);
      if (match) numeroSecuencial = parseInt(match[1]) + 1;
    }
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${fecha}-${numeroSecuencial.toString().padStart(4, '0')}`;
  }
}

// --------------------------- ENDPOINTS ---------------------------

/**
 * @openapi
 * /cajero/procesar-vale/{numeroVale}:
 *   post:
 *     summary: Procesar vale - Completar datos del cliente y cobrar
 */

router.post('/procesar-vale/:numeroVale', [
  param('numeroVale').isString().notEmpty().withMessage('Número de vale requerido'),
  body('tipo_documento').isIn(['ticket', 'boleta', 'factura']).withMessage('Tipo de documento debe ser ticket, boleta o factura'),
  body('metodo_pago').isString().notEmpty().withMessage('Método de pago requerido'),
  body('nombre_cliente').optional().isString().trim(),
  body('telefono_cliente').optional().isString().trim(),
  body('email_cliente').optional().isEmail().withMessage('Email inválido'),
  body('monto_pagado').optional().isNumeric().withMessage('Monto pagado debe ser numérico'),
  body('descuento').optional().isNumeric().withMessage('Descuento debe ser numérico'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { numeroVale } = req.params;
    const {
      nombre_cliente,
      telefono_cliente,
      email_cliente,
      direccion_cliente,
      razon_social,
      rut_cliente,
      tipo_documento,
      metodo_pago,
      monto_pagado,
      descuento = 0,
      observaciones_caja
    } = req.body;
    
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;

    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }

    // 1. Verificar turno
    const turnoActivo = await TurnoCaja.findOne({ 
      where: { id_cajero, estado: 'abierto' }, 
      transaction 
    });
    
    if (!turnoActivo) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno de caja abierto.' 
      });
    }

    // 2. Buscar vale con lock - CORREGIR INCLUDES
    const vale = await Pedido.findOne({
      where: { numero_pedido: numeroVale, estado: { [Op.in]: ['vale_pendiente', 'procesando_caja'] } },
      include: [
        { 
          model: DetallePedido, 
          as: 'detalles', 
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
              model: ModalidadProducto, 
              as: 'modalidad', 
              required: false 
            }
          ]
        },
        { model: Usuario, as: 'vendedor', attributes: ['usuario', 'id_usuario'] },
        { model: Cliente, as: 'cliente', required: false }
      ],
      lock: transaction.LOCK.UPDATE, 
      transaction
    });
    
    if (!vale) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false, 
        message: `Vale ${numeroVale} no encontrado o ya procesado` 
      });
    }
    
    if (vale.estado === 'procesando_caja') {
      const tiempoBloqueo = new Date().getTime() - new Date(vale.fecha_actualizacion).getTime();
      if (tiempoBloqueo < 300000) {
        await transaction.rollback();
        return res.status(409).json({ 
          success: false, 
          message: 'Vale está siendo procesado por otro cajero' 
        });
      }
    }

    // 3. Marcar como procesando
    await vale.update({ 
      estado: 'procesando_caja', 
      fecha_actualizacion: new Date() 
    }, { transaction });

    // 4. Validar descuento
    if (descuento < 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'El descuento no puede ser negativo' 
      });
    }
    const totalFinal = vale.total - descuento;
    if (totalFinal <= 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'El descuento no puede ser mayor o igual al total' 
      });
    }

    // 5. Cliente, según documento
    let clienteId = vale.id_cliente;
    if (tipo_documento === 'factura' && (!vale.cliente || !vale.cliente.datos_completos)) {
      if (!rut_cliente || !razon_social) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Para factura se requiere RUT y razón social' 
        });
      }
      let cliente = await Cliente.findOne({ where: { rut: rut_cliente }, transaction });
      if (!cliente) {
        cliente = await Cliente.create({
          rut: rut_cliente, tipo_cliente: 'empresa', razon_social, nombre: nombre_cliente,
          telefono: telefono_cliente, email: email_cliente, direccion: direccion_cliente, datos_completos: true
        }, { transaction });
      } else {
        await cliente.update({
          razon_social: razon_social || cliente.razon_social,
          nombre: nombre_cliente || cliente.nombre,
          telefono: telefono_cliente || cliente.telefono,
          email: email_cliente || cliente.email,
          direccion: direccion_cliente || cliente.direccion,
          datos_completos: true
        }, { transaction });
      }
      clienteId = cliente.id_cliente;
    }

    // 6. Tipo documento y método pago
    const tipoDoc = await TipoDocumento.findOne({ 
      where: { nombre: tipo_documento.toUpperCase() }, 
      transaction 
    });
    if (!tipoDoc) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Tipo de documento ${tipo_documento} no válido` 
      });
    }
  const metodoPagoObj = await MetodoPago.findOne({
  where: { 
    [Op.or]: [
      { codigo: metodo_pago.toUpperCase() }, 
      Sequelize.where(
        Sequelize.fn('UPPER', Sequelize.col('nombre')), 
        'LIKE', 
        `%${metodo_pago.toUpperCase()}%`
      )
    ] 
  }, 
  transaction
});

    // 7. Actualizar pedido
    const datosActualizados: any = {
      id_cliente: clienteId,
      descuento,
      total: totalFinal,
      tipo_documento,
      estado: 'completado',
      fecha_actualizacion: new Date(),
      observaciones: [
        vale.observaciones,
        observaciones_caja ? `[CAJERO: ${observaciones_caja}]` : '',
        `[PROCESADO POR CAJERO ID:${id_cajero} - ${new Date().toLocaleString('es-CL')}]`
      ].filter(Boolean).join('\n')
    };
    await vale.update(datosActualizados, { transaction });

    // 8. Venta oficial
    const numeroVenta = await generarNumeroVenta(transaction);
    let iva = 0;
    if (tipoDoc.aplica_iva) {
      iva = Math.round((totalFinal - descuento) * 0.19);
    }
    const venta = await Venta.create({
      numero_venta: numeroVenta,
      id_pedido: vale.id_pedido,
      id_turno: turnoActivo.id_turno,
      id_tipo_documento: tipoDoc.id_tipo_documento,
      id_bodega: 1,
      subtotal: vale.subtotal,
      descuento,
      iva,
      total: totalFinal,
      nombre_cliente: nombre_cliente || vale.cliente?.nombre || 'Cliente',
      rut_cliente: rut_cliente || vale.cliente?.rut,
      direccion_cliente: direccion_cliente || vale.cliente?.direccion,
      telefono_cliente: telefono_cliente || vale.cliente?.telefono,
      estado: 'completada'
    }, { transaction });

    // 9. Crear pago
    const montoPagado = monto_pagado || totalFinal;
   await Pago.create({
  id_venta: venta.id_venta,
  id_metodo_pago: metodoPagoObj!.id_metodo,  // ✅ El ! le dice a TS que no es null
  monto: montoPagado
}, { transaction });

    // 10. Stock (llama procedimiento en la BD)
    try {
      await sequelize.query('CALL procesar_venta_stock_bodega(?, ?, ?)', {
        replacements: [venta.id_venta, 1, id_cajero], transaction
      });
    } catch (stockError: any) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Error de stock: ${stockError.message || stockError}`,
        detalle: 'Revisa la disponibilidad de productos en bodega'
      });
    }
    
    await transaction.commit();
    const vuelto = Math.max(0, montoPagado - totalFinal);
    
    res.json({
      success: true,
      data: {
        numero_venta: numeroVenta,
        numero_vale_original: numeroVale,
        total_final: totalFinal,
        descuento_aplicado: descuento,
        iva,
        monto_pagado: montoPagado,
        vuelto,
        tipo_documento,
        metodo_pago: metodoPagoObj!.nombre, 
        vendedor: vale.vendedor?.usuario,
        cliente: nombre_cliente || vale.cliente?.nombre || 'Cliente sin datos',
        productos: vale.detalles?.length || 0,
        turno_caja: turnoActivo.id_turno
      },
      message: `✅ Venta completada - Vale ${numeroVale} procesado exitosamente`,
      instrucciones: vuelto > 0 ? `💰 Entregar vuelto: $${vuelto.toLocaleString('es-CL')}` : undefined
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// ✅ ======================================================================
// ✅ ENDPOINT MEJORADO: /vale/:numeroVale/detalles
// ✅ ======================================================================
router.get('/vale/:numeroVale/detalles', [
  param('numeroVale').isString().notEmpty().withMessage('Número de vale requerido'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numeroVale } = req.params;
    
    console.log(`🔍 [DETALLES] Buscando vale: ${numeroVale}`);
    
    // 1. Buscar usando la función helper
    const resultadoBusqueda = await buscarValePorNumero(numeroVale);
    
    if (!resultadoBusqueda.encontrado) {
      return res.status(404).json({
        success: false,
        message: resultadoBusqueda.mensaje || `Vale ${numeroVale} no encontrado`
      });
    }
    
    // 2. Si es vale antiguo, preguntar al usuario
    if (resultadoBusqueda.esValeAntiguo) {
      return res.status(422).json({
        success: false,
        requiresConfirmation: true,
        message: `Vale #${numeroVale} encontrado pero es de hace ${resultadoBusqueda.diasAtras} días`,
        data: {
          numero_pedido: resultadoBusqueda.numero_pedido,
          dias_atras: resultadoBusqueda.diasAtras,
          accion_sugerida: 'confirmar_vale_antiguo'
        }
      });
    }
    
    // 3. Buscar vale completo con el número_pedido encontrado
    const numeroPedidoCompleto = resultadoBusqueda.numero_pedido!;
    console.log(`📄 Obteniendo detalles del vale: ${numeroPedidoCompleto}`);
    
    const vale = await Pedido.findOne({
      where: { numero_pedido: numeroPedidoCompleto },
      include: [
        {
          model: Usuario,
          as: 'vendedor',
          attributes: ['usuario', 'nombre_completo']
        },
        {
          model: Cliente,
          as: 'cliente',
          attributes: [
            'rut', 'nombre', 'razon_social', 'telefono', 'email', 'direccion', 'tipo_cliente'
          ],
          required: false
        },
        {
          model: DetallePedido,
          as: 'detalles',
          include: [
            {
              model: VarianteProducto,
              as: 'varianteProducto',
              include: [{
                model: Producto,
                as: 'producto',
                attributes: [
                  'nombre', 'codigo', 'unidad_medida', 'descripcion', 'tipo'
                ]
              }]
            },
            {
              model: ModalidadProducto,
              as: 'modalidad',
              attributes: ['nombre', 'descripcion', 'cantidad_base'],
              required: false
            }
          ]
        }
      ]
    });
    
    if (!vale) {
      console.log(`❌ Vale no encontrado en segunda búsqueda: ${numeroPedidoCompleto}`);
      return res.status(404).json({
        success: false,
        message: `Error interno: Vale ${numeroVale} no encontrado`
      });
    }

    console.log(`✅ Vale encontrado: ${vale.numero_pedido} (Diario: ${vale.numero_diario})`);
    
    // 4. Formatear respuesta
    const detallesFormateados = {
      numero_vale: vale.numero_pedido,
      numero_diario: vale.numero_diario,
      numero_display: vale.numero_diario 
        ? `#${String(vale.numero_diario).padStart(3, '0')}`
        : vale.numero_pedido,
      vendedor: vale.vendedor?.nombre_completo || vale.vendedor?.usuario,
      fecha_creacion: vale.fecha_creacion,
      estado: vale.estado,
      tipo_documento: vale.tipo_documento,
      puede_procesarse: ['vale_pendiente', 'procesando_caja'].includes(vale.estado),
      puede_anularse: ['vale_pendiente'].includes(vale.estado),
      
      // ✅ ADVERTENCIA SI ES VALE ANTIGUO
      es_vale_antiguo: resultadoBusqueda.esValeAntiguo || false,
      dias_atras: resultadoBusqueda.diasAtras || 0,
      advertencia: resultadoBusqueda.esValeAntiguo 
        ? `⚠️ Este vale es de hace ${resultadoBusqueda.diasAtras} días`
        : null,
      
      cliente_info: vale.cliente ? {
        tiene_cliente: true,
        rut: vale.cliente.rut,
        nombre: vale.cliente.nombre,
        razon_social: vale.cliente.razon_social,
        telefono: vale.cliente.telefono,
        email: vale.cliente.email,
        direccion: vale.cliente.direccion,
        tipo_cliente: vale.cliente.tipo_cliente
      } : {
        tiene_cliente: false,
        requiere_datos: vale.tipo_documento === 'factura'
      },
      productos: vale.detalles?.map(detalle => ({
        producto: detalle.varianteProducto?.producto?.nombre || 'Producto no encontrado',
        codigo: detalle.varianteProducto?.producto?.codigo,
        tipo: detalle.varianteProducto?.producto?.tipo,
        descripcion: detalle.varianteProducto?.producto?.descripcion,
        variante: {
          sku: detalle.varianteProducto?.sku,
          color: detalle.varianteProducto?.color,
          medida: detalle.varianteProducto?.medida,
          material: detalle.varianteProducto?.material,
          descripcion_completa: detalle.varianteProducto?.getDescripcionCompleta?.() ||
            [detalle.varianteProducto?.color, detalle.varianteProducto?.medida, detalle.varianteProducto?.material]
              .filter(Boolean).join(' - ') || 'Estándar'
        },
        modalidad: detalle.modalidad ? {
          nombre: detalle.modalidad.nombre,
          descripcion: detalle.modalidad.descripcion,
          cantidad_base: detalle.modalidad.cantidad_base
        } : null,
        cantidad: detalle.cantidad,
        unidad: detalle.varianteProducto?.producto?.unidad_medida,
        precio_unitario: detalle.precio_unitario,
        tipo_precio: detalle.tipo_precio,
        subtotal: detalle.subtotal,
        observaciones: detalle.observaciones,
        descripcion_completa: detalle.getDescripcionCompleta?.() || 
          `${detalle.varianteProducto?.producto?.nombre || 'Producto'} - ${detalle.cantidad} ${detalle.varianteProducto?.producto?.unidad_medida || 'und'}`
      })),
      totales: {
        subtotal: vale.subtotal,
        descuento: vale.descuento,
        total: vale.total
      },
      notas_vendedor: vale.observaciones,
      tiempo_espera: Math.floor(
        (new Date().getTime() - new Date(vale.fecha_creacion).getTime()) / 60000
      )
    };
    
    res.json({ success: true, data: detallesFormateados });
  } catch (error) {
    console.error('❌ Error en /vale/:numeroVale/detalles:', error);
    next(error);
  }
});

// ✅ ======================================================================
// ✅ ENDPOINT MEJORADO: /vale/:numeroVale (información básica)
// ✅ ======================================================================
router.get('/vale/:numeroVale', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numeroVale } = req.params;
    
    console.log(`🔍 [BÁSICO] Buscando vale: ${numeroVale}`);
    
    // 1. Buscar usando la función helper
    const resultadoBusqueda = await buscarValePorNumero(numeroVale);
    
    if (!resultadoBusqueda.encontrado) {
      return res.status(404).json({
        success: false,
        message: resultadoBusqueda.mensaje || `Vale ${numeroVale} no encontrado`
      });
    }
    
    // 2. Si es vale antiguo, incluir advertencia en la respuesta
    if (resultadoBusqueda.esValeAntiguo) {
      // Para el endpoint básico, seguimos devolviendo el vale pero con advertencia
      console.log(`⚠️ Vale antiguo de hace ${resultadoBusqueda.diasAtras} días`);
    }
    
    // 3. Buscar vale completo
    const numeroPedidoCompleto = resultadoBusqueda.numero_pedido!;
    
    const vale = await Pedido.findOne({
      where: { numero_pedido: numeroPedidoCompleto },
      include: [
        { 
          model: Usuario, 
          as: 'vendedor', 
          attributes: ['usuario', 'nombre_completo'] 
        },
        { 
          model: Cliente, 
          as: 'cliente', 
          attributes: ['nombre', 'rut', 'razon_social', 'telefono', 'email', 'direccion'],
          required: false 
        },
        {
          model: DetallePedido,
          as: 'detalles',
          include: [
            {
              model: VarianteProducto,
              as: 'varianteProducto',
              include: [{
                model: Producto,
                as: 'producto',
                attributes: ['nombre', 'codigo', 'unidad_medida']
              }]
            }
          ]
        }
      ]
    });
    
    if (!vale) {
      return res.status(404).json({
        success: false,
        message: `Error interno: Vale ${numeroVale} no encontrado`
      });
    }

    console.log(`✅ Vale básico encontrado: ${vale.numero_pedido} (Diario: ${vale.numero_diario})`);
    
    // 4. Formatear respuesta básica
    const valeFormateado = {
      numero_cliente: vale.numero_pedido,
      numero: vale.numero_pedido,
      numero_diario: vale.numero_diario,
      numero_display: vale.numero_diario 
        ? `#${String(vale.numero_diario).padStart(3, '0')}`
        : vale.numero_pedido,
      cliente_nombre: vale.cliente?.nombre || vale.cliente?.razon_social || 'Cliente sin datos',
      vendedor_nombre: vale.vendedor?.nombre_completo || vale.vendedor?.usuario,
      fecha: vale.fecha_creacion,
      total: vale.total,
      monto_total: vale.total,
      estado: vale.estado,
      puede_procesarse: ['vale_pendiente', 'procesando_caja'].includes(vale.estado),
      puede_anularse: ['vale_pendiente'].includes(vale.estado),
      
      // ✅ ADVERTENCIA SI ES VALE ANTIGUO
      es_vale_antiguo: resultadoBusqueda.esValeAntiguo || false,
      dias_atras: resultadoBusqueda.diasAtras || 0,
      advertencia: resultadoBusqueda.esValeAntiguo 
        ? `⚠️ Este vale es de hace ${resultadoBusqueda.diasAtras} días`
        : null,
      
      productos: vale.detalles?.map(detalle => ({
        nombre: detalle.varianteProducto?.producto?.nombre || 'Producto',
        descripcion: detalle.varianteProducto?.color && detalle.varianteProducto?.medida 
                    ? `${detalle.varianteProducto.color} ${detalle.varianteProducto.medida}`.trim()
                    : detalle.varianteProducto?.color || detalle.varianteProducto?.medida || '',
        cantidad: detalle.cantidad,
        precio: detalle.precio_unitario,
        total: detalle.subtotal,
        unidad_medida: detalle.varianteProducto?.producto?.unidad_medida || ''
      })) || [],
      cliente: vale.cliente?.nombre || vale.cliente?.razon_social || 'Cliente sin datos',
      vendedor: vale.vendedor?.nombre_completo || vale.vendedor?.usuario,
      items: vale.detalles?.map(detalle => ({
        nombre: detalle.varianteProducto?.producto?.nombre || 'Producto',
        descripcion: detalle.varianteProducto?.color && detalle.varianteProducto?.medida 
                    ? `${detalle.varianteProducto.color} ${detalle.varianteProducto.medida}`.trim()
                    : detalle.varianteProducto?.color || detalle.varianteProducto?.medida || '',
        cantidad: detalle.cantidad,
        precio: detalle.precio_unitario,
        total: detalle.subtotal
      })) || []
    };
    
    res.json({ 
      success: true, 
      data: valeFormateado 
    });
  } catch (error) {
    console.error('❌ Error en /vale/:numeroVale:', error);
    next(error);
  }
});

// ✅ ======================================================================
// ✅ NUEVO ENDPOINT: Confirmar vale antiguo
// ✅ ======================================================================
router.post('/vale/:numeroVale/confirmar-antiguo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numeroVale } = req.params;
    const { confirmar } = req.body;
    
    if (!confirmar) {
      return res.status(400).json({
        success: false,
        message: 'Confirmación requerida para procesar vale antiguo'
      });
    }
    
    console.log(`✅ Usuario confirmó procesar vale antiguo: ${numeroVale}`);
    
    // Redirigir a obtener detalles normalmente (forzando la búsqueda)
    // Aquí podrías implementar lógica específica si necesitas
    
    res.json({
      success: true,
      message: 'Vale antiguo confirmado',
      redirect_to: `/cajero/vale/${numeroVale}/detalles`
    });
    
  } catch (error) {
    console.error('❌ Error confirmando vale antiguo:', error);
    next(error);
  }
});

// ✅ ======================================================================
// ✅ ENDPOINT DEBUG: Ver todos los vales del día - CON TIPADO CORRECTO
// ✅ ======================================================================
router.get('/debug/vales-del-dia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const valesHoy = await sequelize.query(`
      SELECT 
        id_pedido,
        numero_pedido,
        numero_diario,
        estado,
        total,
        DATE(fecha_creacion) as fecha_vale,
        TIME(fecha_creacion) as hora_vale
      FROM pedidos 
      WHERE DATE(fecha_creacion) = CURDATE()
      ORDER BY numero_diario ASC
    `, { type: QueryTypes.SELECT }) as ValeDelDia[];
    
    res.json({
      success: true,
      fecha: new Date().toISOString().split('T')[0],
      total_vales: valesHoy.length,
      vales: valesHoy
    });
  } catch (error) {
    next(error);
  }
});

/************************** */

/**
 * @openapi
 * /cajero/anular-vale/{numeroVale}:
 *   post:
 *     summary: Anular un vale pendiente
 */

router.post('/anular-vale/:numeroVale', [
  param('numeroVale').isString().notEmpty(),
  body('motivo_anulacion').isString().notEmpty().withMessage('Motivo de anulación requerido'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { numeroVale } = req.params;
    const { motivo_anulacion } = req.body;
    
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const vale = await Pedido.findOne({
      where: {
        numero_pedido: numeroVale,
        estado: { [Op.in]: ['vale_pendiente', 'procesando_caja'] }
      },
      transaction
    });
    
    if (!vale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Vale ${numeroVale} no encontrado o ya procesado`
      });
    }
    
    await vale.update({
      estado: 'cancelado',
      observaciones: `${vale.observaciones ?? ''}\n[ANULADO POR CAJERO ID:${id_cajero} - ${motivo_anulacion} - ${new Date().toLocaleString('es-CL')}]`,
      fecha_actualizacion: new Date()
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: `✅ Vale ${numeroVale} anulado exitosamente`,
      data: {
        numero_vale: numeroVale,
        estado: 'cancelado',
        motivo: motivo_anulacion
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /cajero/abrir-turno:
 *   post:
 *     summary: Abrir turno de caja
 */

router.post('/abrir-turno', [
  body('id_caja').isInt().withMessage('ID de caja debe ser un número'),
  body('monto_inicial').isNumeric().withMessage('Monto inicial debe ser numérico'),
  body('observaciones_apertura').optional().isString(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { id_caja, monto_inicial, observaciones_apertura } = req.body;
    
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoExistente = await TurnoCaja.findOne({
      where: { id_cajero, estado: 'abierto' },
      transaction
    });
    
    if (turnoExistente) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Ya tienes un turno abierto' 
      });
    }
    
    const nuevoTurno = await TurnoCaja.create({
      id_caja,
      id_cajero,
      fecha_apertura: new Date(),
      monto_inicial,
      observaciones_apertura
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id_turno: nuevoTurno.id_turno,
        monto_inicial,
        fecha_apertura: nuevoTurno.fecha_apertura
      },
      message: '✅ Turno abierto exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /cajero/cerrar-turno:
 *   post:
 *     summary: Cerrar turno de caja
 */

router.post('/cerrar-turno', [
  body('monto_real_cierre').isNumeric().withMessage('Monto real de cierre debe ser numérico'),
  body('observaciones_cierre').optional().isString(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { monto_real_cierre, observaciones_cierre } = req.body;
    
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoActivo = await TurnoCaja.findOne({
      where: { id_cajero, estado: 'abierto' },
      transaction
    });
    
    if (!turnoActivo) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno abierto para cerrar' 
      });
    }
    
    const resultados = await sequelize.query(
      'SELECT calcular_dinero_teorico_turno(?) as dinero_teorico',
      { replacements: [turnoActivo.id_turno], transaction }
    ) as any[];
    const dineroTeorico = resultados[0]?.[0]?.dinero_teorico || 0;
    const diferencia = monto_real_cierre - dineroTeorico;
    
    await turnoActivo.update({
      fecha_cierre: new Date(),
      monto_real_cierre,
      monto_teorico_cierre: dineroTeorico,
      diferencia,
      estado: 'cerrado',
      observaciones_cierre
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id_turno: turnoActivo.id_turno,
        dinero_teorico: dineroTeorico,
        dinero_real: monto_real_cierre,
        diferencia,
        estado_diferencia: diferencia === 0 ? 'perfecto' : diferencia > 0 ? 'sobrante' : 'faltante',
        total_ventas: turnoActivo.total_ventas,
        cantidad_ventas: turnoActivo.cantidad_ventas
      },
      message: '✅ Turno cerrado exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /cajero/arqueo-intermedio:
 *   post:
 *     summary: Realizar arqueo intermedio durante el turno
 */

router.post('/arqueo-intermedio', [
  body('conteo_billetes').isObject().withMessage('Conteo de billetes requerido'),
  body('conteo_billetes.billetes_20000').isInt({ min: 0 }),
  body('conteo_billetes.billetes_10000').isInt({ min: 0 }),
  body('conteo_billetes.billetes_5000').isInt({ min: 0 }),
  body('conteo_billetes.billetes_2000').isInt({ min: 0 }),
  body('conteo_billetes.billetes_1000').isInt({ min: 0 }),
  body('conteo_monedas').isObject().withMessage('Conteo de monedas requerido'),
  body('conteo_monedas.monedas_500').isInt({ min: 0 }),
  body('conteo_monedas.monedas_100').isInt({ min: 0 }),
  body('conteo_monedas.monedas_50').isInt({ min: 0 }),
  body('conteo_monedas.monedas_10').isInt({ min: 0 }),
  body('observaciones').optional().isString(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { conteo_billetes, conteo_monedas, observaciones } = req.body;
    
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoActivo = await TurnoCaja.findOne({
      where: { id_cajero, estado: 'abierto' },
      transaction
    });
    
    if (!turnoActivo) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno abierto para realizar arqueo' 
      });
    }
    
    const totalBilletes =
      (conteo_billetes.billetes_20000 || 0) * 20000 +
      (conteo_billetes.billetes_10000 || 0) * 10000 +
      (conteo_billetes.billetes_5000 || 0) * 5000 +
      (conteo_billetes.billetes_2000 || 0) * 2000 +
      (conteo_billetes.billetes_1000 || 0) * 1000;
      
    const totalMonedas =
      (conteo_monedas.monedas_500 || 0) * 500 +
      (conteo_monedas.monedas_100 || 0) * 100 +
      (conteo_monedas.monedas_50 || 0) * 50 +
      (conteo_monedas.monedas_10 || 0) * 10;
      
    const totalContado = totalBilletes + totalMonedas;
    
    const resultados = await sequelize.query(
      'SELECT calcular_dinero_teorico_turno(?) as dinero_teorico',
      { replacements: [turnoActivo.id_turno], transaction }
    ) as any[];
    const totalTeorico = resultados[0]?.[0]?.dinero_teorico || 0;
    const diferencia = totalContado - totalTeorico;
    
    const arqueo = await ArqueoCaja.create({
      id_turno: turnoActivo.id_turno,
      billetes_20000: conteo_billetes.billetes_20000 || 0,
      billetes_10000: conteo_billetes.billetes_10000 || 0,
      billetes_5000: conteo_billetes.billetes_5000 || 0,
      billetes_2000: conteo_billetes.billetes_2000 || 0,
      billetes_1000: conteo_billetes.billetes_1000 || 0,
      monedas_500: conteo_monedas.monedas_500 || 0,
      monedas_100: conteo_monedas.monedas_100 || 0,
      monedas_50: conteo_monedas.monedas_50 || 0,
      monedas_10: conteo_monedas.monedas_10 || 0,
      total_contado: totalContado,
      total_teorico: totalTeorico,
      diferencia: diferencia,
      observaciones: observaciones || `Arqueo intermedio - ${new Date().toLocaleString('es-CL')}`
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: {
        id_arqueo: arqueo.id_arqueo,
        total_contado: totalContado,
        total_teorico: totalTeorico,
        diferencia: diferencia,
        estado_diferencia: diferencia === 0 ? 'perfecto' : diferencia > 0 ? 'sobrante' : 'faltante',
        detalle_conteo: {
          billetes: {
            '$20.000': conteo_billetes.billetes_20000 || 0,
            '$10.000': conteo_billetes.billetes_10000 || 0,
            '$5.000': conteo_billetes.billetes_5000 || 0,
            '$2.000': conteo_billetes.billetes_2000 || 0,
            '$1.000': conteo_billetes.billetes_1000 || 0,
            subtotal: totalBilletes
          },
          monedas: {
            '$500': conteo_monedas.monedas_500 || 0,
            '$100': conteo_monedas.monedas_100 || 0,
            '$50': conteo_monedas.monedas_50 || 0,
            '$10': conteo_monedas.monedas_10 || 0,
            subtotal: totalMonedas
          }
        },
        fecha_arqueo: arqueo.fecha_arqueo
      },
      message: diferencia === 0 ?
        '✅ Arqueo perfecto - Sin diferencias' :
        `⚠️ Diferencia: ${Math.abs(diferencia).toLocaleString('es-CL')} ${diferencia > 0 ? 'sobrante' : 'faltante'}`,
      recomendacion: Math.abs(diferencia) > 5000 ?
        'Diferencia significativa - Revisar movimientos del turno' :
        'Diferencia dentro del rango normal'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @openapi
 * /cajero/historial-arqueos:
 *   get:
 *     summary: Ver historial de arqueos del turno actual
 */

router.get('/historial-arqueos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoActivo = await TurnoCaja.findOne({
      where: { id_cajero, estado: 'abierto' }
    });
    
    if (!turnoActivo) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno abierto' 
      });
    }
    
    const arqueos = await ArqueoCaja.findAll({
      where: { id_turno: turnoActivo.id_turno },
      order: [['fecha_arqueo', 'DESC']]
    });
    
    const arqueosFormateados = arqueos.map(arqueo => ({
      id_arqueo: arqueo.id_arqueo,
      fecha_arqueo: arqueo.fecha_arqueo,
      hora_arqueo: new Date(arqueo.fecha_arqueo).toLocaleTimeString('es-CL'),
      total_contado: arqueo.total_contado,
      total_teorico: arqueo.total_teorico,
      diferencia: arqueo.diferencia,
      estado: arqueo.diferencia === 0 ? 'perfecto' : arqueo.diferencia > 0 ? 'sobrante' : 'faltante',
      observaciones: arqueo.observaciones,
      tiempo_desde_arqueo: Math.floor((new Date().getTime() - new Date(arqueo.fecha_arqueo).getTime()) / 60000)
    }));
    
    // Estadísticas rápidas del turno
    const estadisticas = {
      total_arqueos: arqueos.length,
      diferencia_promedio: arqueos.length > 0 ? arqueos.reduce((sum, a) => sum + a.diferencia, 0) / arqueos.length : 0,
      mayor_diferencia: arqueos.length > 0 ? Math.max(...arqueos.map(a => Math.abs(a.diferencia))) : 0,
      arqueos_perfectos: arqueos.filter(a => a.diferencia === 0).length,
      ultimo_arqueo: arqueos.length > 0 ? Math.floor((new Date().getTime() - new Date(arqueos[0].fecha_arqueo).getTime()) / 60000) : null
    };
    
    res.json({
      success: true,
      data: {
        turno_actual: {
          id_turno: turnoActivo.id_turno,
          fecha_apertura: turnoActivo.fecha_apertura,
          total_ventas: turnoActivo.total_ventas || 0,
          cantidad_ventas: turnoActivo.cantidad_ventas || 0
        },
        arqueos: arqueosFormateados,
        estadisticas
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cajero/ultimo-arqueo:
 *   get:
 *     summary: Ver el último arqueo realizado
 */

router.get('/ultimo-arqueo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoActivo = await TurnoCaja.findOne({
      where: { id_cajero, estado: 'abierto' }
    });
    
    if (!turnoActivo) {
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno abierto' 
      });
    }
    
    const ultimoArqueo = await ArqueoCaja.findOne({
      where: { id_turno: turnoActivo.id_turno },
      order: [['fecha_arqueo', 'DESC']]
    });
    
    if (!ultimoArqueo) {
      return res.json({
        success: true,
        data: {
          tiene_arqueos: false,
          mensaje: 'No se han realizado arqueos en este turno',
          recomendacion: 'Considera realizar un arqueo intermedio para verificar el estado de caja'
        }
      });
    }
    
    const tiempoDesdeArqueo = Math.floor(
      (new Date().getTime() - new Date(ultimoArqueo.fecha_arqueo).getTime()) / 60000
    );
    
    const resultados = await sequelize.query(
      'SELECT calcular_dinero_teorico_turno(?) as dinero_teorico',
      { replacements: [turnoActivo.id_turno] }
    ) as any[];
    const dineroTeoricoActual = resultados[0]?.[0]?.dinero_teorico || 0;
    const ventasDesdeArqueo = dineroTeoricoActual - ultimoArqueo.total_teorico;
    
    res.json({
      success: true,
      data: {
        tiene_arqueos: true,
        ultimo_arqueo: {
          fecha: ultimoArqueo.fecha_arqueo,
          hace_minutos: tiempoDesdeArqueo,
          total_contado: ultimoArqueo.total_contado,
          total_teorico: ultimoArqueo.total_teorico,
          diferencia: ultimoArqueo.diferencia,
          estado: ultimoArqueo.diferencia === 0 ? 'perfecto' : ultimoArqueo.diferencia > 0 ? 'sobrante' : 'faltante'
        },
        situacion_actual: {
          dinero_teorico_actual: dineroTeoricoActual,
          ventas_desde_arqueo: ventasDesdeArqueo,
          cambio_desde_arqueo: dineroTeoricoActual - ultimoArqueo.total_contado
        },
        recomendacion: tiempoDesdeArqueo > 120 ?
          'Considera realizar un nuevo arqueo (han pasado más de 2 horas)' :
          tiempoDesdeArqueo > 60 ?
            'Podrías realizar un arqueo de control' :
            'Arqueo reciente - Todo en orden'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cajero/estadisticas:
 *   get:
 *     summary: Obtener estadísticas del cajero para el dashboard
 */
router.get('/estadisticas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Corregir el type casting para query parameters
    const fechaParam = req.query.fecha;
    const fecha = typeof fechaParam === 'string' ? fechaParam : new Date().toISOString().split('T')[0];
    
    // Obtener vales del día
    const inicioFecha = new Date(`${fecha}T00:00:00.000Z`);
    const finFecha = new Date(`${fecha}T23:59:59.999Z`);
    
    const valesDelDia = await Pedido.findAll({
      where: {
        fecha_creacion: { [Op.between]: [inicioFecha, finFecha] }
      },
      attributes: ['estado', 'total']
    });
    
    // Obtener vales pendientes históricos
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 7);
    
    // Corregir el where para vales pendientes históricos
    const whereHistoricos: any = {
      fecha_creacion: { [Op.gte]: fechaLimite }
    };
    whereHistoricos.estado = { [Op.in]: ['vale_pendiente', 'procesando_caja'] };
    
    const valesPendientesHistoricos = await Pedido.findAll({
      where: whereHistoricos,
      attributes: ['fecha_creacion', 'total']
    });
    
    // Calcular estadísticas del día actual
    const estadisticasDia = {
      fecha: fecha,
      total_vales: valesDelDia.length,
      pendientes: valesDelDia.filter(v => v.estado === 'vale_pendiente').length,
      procesando: valesDelDia.filter(v => v.estado === 'procesando_caja').length,
      monto_total: valesDelDia
        .filter(v => v.estado === 'completado')
        .reduce((sum, v) => sum + Number(v.total), 0)
    };
    
    // Calcular estadísticas de pendientes históricos
    const fechasUnicas = new Set(
      valesPendientesHistoricos.map(v => 
        new Date(v.fecha_creacion).toDateString()
      )
    );
    
    const estadisticasHistoricas = {
      total: valesPendientesHistoricos.length,
      monto_total: valesPendientesHistoricos.reduce((sum, v) => sum + Number(v.total), 0),
      dias_con_pendientes: fechasUnicas.size
    };
    
    const estadisticas = {
      dia_actual: estadisticasDia,
      pendientes_historicos: estadisticasHistoricas
    };
    
    res.json({
      success: true,
      data: estadisticas
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /cajero/estado-turno:
 *   get:
 *     summary: Verificar estado actual del turno de caja
 */
router.get('/estado-turno', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ✅ CORREGIDO: Usar req.user.id en lugar de req.user.id_usuario
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    const turnoActivo = await TurnoCaja.findOne({
      where: { 
        id_cajero, 
        estado: 'abierto' 
      },
      include: [
        {
          model: Caja,
          as: 'caja',
          attributes: ['nombre', 'ubicacion']
        }
      ]
    });
    
    if (turnoActivo) {
      // Calcular estadísticas del turno
      const tiempoAbierto = Math.floor(
        (new Date().getTime() - new Date(turnoActivo.fecha_apertura).getTime()) / 60000
      );
      
      res.json({
        success: true,
        data: {
          turno_abierto: true,
          id_turno: turnoActivo.id_turno,
          fecha_apertura: turnoActivo.fecha_apertura,
          monto_inicial: turnoActivo.monto_inicial,
          tiempo_abierto_minutos: tiempoAbierto,
          caja: (turnoActivo as any).caja?.nombre || 'Caja Principal',
          total_ventas: turnoActivo.total_ventas || 0,
          cantidad_ventas: turnoActivo.cantidad_ventas || 0
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          turno_abierto: false,
          mensaje: 'No hay turno de caja abierto'
        }
      });
    }
    
  } catch (error) {
    next(error);
  }
});

export default router;