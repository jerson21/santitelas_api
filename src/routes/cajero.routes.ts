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
async function generarNumeroVenta(transaction?: Transaction, fechaVale?: Date): Promise<string> {
  // CAMBIO: Usar la fecha del vale si se proporciona, sino usar fecha actual
  const fechaBase = fechaVale || new Date();
  const año = fechaBase.getFullYear();
  const mes = String(fechaBase.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaBase.getDate()).padStart(2, '0');
  
  try {
    // Intentar usar el procedimiento almacenado primero
    const resultados = await sequelize.query(
      'SELECT generar_numero_venta(?) as numero',
      { 
        replacements: [fechaBase.toISOString().split('T')[0]], // Pasar fecha como parámetro
        transaction 
      }
    ) as any[];
    
    if (resultados[0]?.[0]?.numero) {
      return resultados[0][0].numero;
    }
  } catch (error) {
    console.log('Procedimiento almacenado falló, usando fallback manual');
  }
  
  // Fallback manual mejorado
  const prefijo = `VT${año}${mes}${dia}`;
  
  // Buscar el último número de venta DE ESA FECHA ESPECÍFICA
  const ultimaVenta = await Venta.findOne({
    where: {
      numero_venta: { [Op.like]: `${prefijo}-%` }
    },
    order: [['numero_venta', 'DESC']],
    transaction
  });
  
  let numeroSecuencial = 1;
  if (ultimaVenta) {
    const match = ultimaVenta.numero_venta.match(/-(\d+)$/);
    if (match) numeroSecuencial = parseInt(match[1]) + 1;
  }
  
  return `${prefijo}-${numeroSecuencial.toString().padStart(4, '0')}`;
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
  body('nombre_cliente').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('telefono_cliente').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('email_cliente').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('monto_pagado').optional({ nullable: true, checkFalsy: true }).isNumeric().withMessage('Monto pagado debe ser numérico'),
  body('descuento').optional({ nullable: true, checkFalsy: true }).isNumeric().withMessage('Descuento debe ser numérico'),
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
      comuna,
      giro,
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

    // 5. Cliente - Guardar/Actualizar siempre que haya datos completos
    let clienteId = vale.id_cliente;

    // ✅ VALIDACIÓN OBLIGATORIA PARA FACTURA
    if (tipo_documento === 'factura' && (!rut_cliente || !razon_social)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Para factura se requiere RUT y razón social'
        });
    }

    // ✅ GUARDAR EN CLIENTE: Si hay RUT, guardar/actualizar independiente del tipo de documento
    if (rut_cliente) {
      console.log(`📝 Datos recibidos para guardar cliente:`, {
        rut: rut_cliente,
        razon_social,
        nombre_cliente,
        direccion_cliente,
        comuna,
        giro,
        email_cliente,
        telefono_cliente
      });

      let cliente = await Cliente.findOne({ where: { rut: rut_cliente }, transaction });

      if (!cliente) {
        // Crear nuevo cliente
        // Determinar si es empresa o persona: si tiene giro, es empresa
        const esEmpresa = !!(giro && giro.trim());

        cliente = await Cliente.create({
          rut: rut_cliente,
          tipo_cliente: esEmpresa ? 'empresa' : 'persona',
          razon_social: esEmpresa ? (razon_social || null) : null,
          nombre: nombre_cliente || razon_social || 'Cliente',
          telefono: telefono_cliente || null,
          email: email_cliente || null,
          direccion: direccion_cliente || null,
          comuna: comuna || null,
          giro: esEmpresa ? giro : null,
          datos_completos: !!(rut_cliente && (razon_social || nombre_cliente) && direccion_cliente)
        }, { transaction });
        console.log(`✅ Cliente creado:`, {
          rut: cliente.rut,
          nombre: cliente.nombre,
          razon_social: cliente.razon_social,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          giro: cliente.giro
        });
      } else {
        // Actualizar cliente existente solo con los campos que vengan
        const datosAnteriores = {
          razon_social: cliente.razon_social,
          nombre: cliente.nombre,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          giro: cliente.giro
        };

        // Determinar si es empresa o persona: si tiene giro, es empresa
        const esEmpresa = !!(giro && giro.trim());

        await cliente.update({
          tipo_cliente: esEmpresa ? 'empresa' : 'persona',
          razon_social: razon_social || cliente.razon_social,
          nombre: nombre_cliente || cliente.nombre,
          telefono: telefono_cliente || cliente.telefono,
          email: email_cliente || cliente.email,
          direccion: direccion_cliente || cliente.direccion,
          comuna: comuna || cliente.comuna,
          giro: giro || cliente.giro,
          datos_completos: true
        }, { transaction });

        console.log(`✅ Cliente actualizado:`, {
          rut: cliente.rut,
          datos_anteriores: datosAnteriores,
          datos_nuevos: {
            razon_social: cliente.razon_social,
            nombre: cliente.nombre,
            direccion: cliente.direccion,
            comuna: cliente.comuna,
            giro: cliente.giro
          }
        });
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
const numeroVenta = await generarNumeroVenta(transaction, vale.fecha_creacion);
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
      razon_social: razon_social || vale.cliente?.razon_social,
      direccion_cliente: direccion_cliente || vale.cliente?.direccion,
      comuna: comuna || vale.cliente?.comuna,
      giro: giro || vale.cliente?.giro,
      telefono_cliente: telefono_cliente || vale.cliente?.telefono,
      email_cliente: email_cliente || vale.cliente?.email,
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
// En cajero.routes.ts - ACTUALIZACIÓN del endpoint /vale/:numeroVale/detalles

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
            'id_cliente',
            'rut',
            'nombre',
            'razon_social',
            'telefono',
            'email',
            'direccion',
            'comuna',
            'giro',
            'tipo_cliente',
            'datos_completos'
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
              attributes: ['nombre', 'descripcion', 'cantidad_base', 'afecto_descuento_ticket'],
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
    console.log(`👤 Cliente asociado: ${vale.cliente ? `${vale.cliente.nombre || vale.cliente.razon_social} (${vale.cliente.rut})` : 'Sin cliente'}`);
    console.log(`📝 Datos completos: ${vale.datos_completos ? 'Sí' : 'No'}`);
    
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
      
      // ✅ INFORMACIÓN DEL CLIENTE MEJORADA
      cliente_info: vale.cliente ? {
        tiene_cliente: true,
        id_cliente: vale.cliente.id_cliente,
        rut: vale.cliente.rut,
        nombre: vale.cliente.nombre || vale.cliente.razon_social || 'Sin nombre',
        razon_social: vale.cliente.razon_social,
        telefono: vale.cliente.telefono,
        email: vale.cliente.email,
        direccion: vale.cliente.direccion,
        comuna: vale.cliente.comuna,
        giro: vale.cliente.giro,
        tipo_cliente: vale.cliente.tipo_cliente,
        datos_completos: vale.cliente.datos_completos,
        requiere_completar: !vale.cliente.datos_completos,
        mensaje: vale.cliente.datos_completos
          ? '✅ Cliente con datos completos'
          : '⚠️ Faltan datos del cliente'
      } : {
        tiene_cliente: false,
        requiere_datos: vale.tipo_documento === 'factura',
        mensaje: vale.tipo_documento === 'factura'
          ? '❌ Factura requiere datos del cliente'
          : 'ℹ️ Sin cliente asociado'
      },
      
      // ✅ NUEVO: Indicador de datos completos del pedido
      datos_completos: vale.datos_completos,
      requiere_accion_cajero: !vale.datos_completos || (vale.tipo_documento === 'factura' && !vale.cliente),
      
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
          cantidad_base: detalle.modalidad.cantidad_base,
          afecto_descuento_ticket: detalle.modalidad.afecto_descuento_ticket
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

      // ✅ INFORMACIÓN DE PAGO (si está completado)
      ...(vale.estado === 'completado' ? {
        metodo_pago: (vale as any).metodo_pago,
        cuenta_transferencia: (vale as any).cuenta_transferencia,
        monto_pagado: (vale as any).monto_pagado,
        monto_cambio: (vale as any).monto_cambio,
        fecha_cobro: (vale as any).fecha_cobro,
        cajero_cobro: (vale as any).cajero_cobro
      } : {}),

      notas_vendedor: vale.observaciones,
      tiempo_espera: Math.floor(
        (new Date().getTime() - new Date(vale.fecha_creacion).getTime()) / 60000
      ),
      
      // ✅ NUEVO: Instrucciones para el cajero
      instrucciones_cajero: (() => {
        const instrucciones = [];
        
        if (!vale.datos_completos) {
          if (vale.tipo_documento === 'factura' && !vale.cliente) {
            instrucciones.push('🔴 OBLIGATORIO: Solicitar RUT y razón social del cliente para factura');
          } else if (vale.cliente && !vale.cliente.datos_completos) {
            instrucciones.push('⚠️ Completar datos faltantes del cliente');
          } else if (!vale.cliente) {
            instrucciones.push('ℹ️ Opcionalmente puede agregar datos del cliente');
          }
        }
        
        return instrucciones;
      })()
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
// ✅ NUEVO ENDPOINT: Guardar/Actualizar cliente inmediatamente
// ✅ ======================================================================
router.post('/guardar-cliente', [
  body('rut').isString().notEmpty().withMessage('RUT es obligatorio'),
  body('razon_social').isString().notEmpty().withMessage('Razón social es obligatoria'),
  body('direccion').isString().notEmpty().withMessage('Dirección es obligatoria'),
  body('comuna').isString().notEmpty().withMessage('Comuna es obligatoria'),
  body('giro').isString().notEmpty().withMessage('Giro es obligatorio'),
  body('correo').optional().isEmail().withMessage('Email inválido'),
  body('telefono').optional().isString().trim(),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      rut,
      razon_social,
      direccion,
      comuna,
      giro,
      correo,
      telefono
    } = req.body;

    console.log(`💾 [GUARDAR CLIENTE] Datos recibidos:`, {
      rut,
      razon_social,
      direccion,
      comuna,
      giro,
      correo,
      telefono
    });

    // Buscar si el cliente ya existe
    let cliente = await Cliente.findOne({ where: { rut }, transaction });

    if (!cliente) {
      // Crear nuevo cliente
      // Determinar si es empresa o persona: si tiene giro, es empresa
      const esEmpresa = !!(giro && giro.trim());

      cliente = await Cliente.create({
        rut,
        tipo_cliente: esEmpresa ? 'empresa' : 'persona',
        razon_social: esEmpresa ? razon_social : null,
        nombre: razon_social, // Usamos razon_social como nombre (puede ser nombre personal o de empresa)
        telefono: telefono || null,
        email: correo || null,
        direccion,
        comuna,
        giro: esEmpresa ? giro : null,
        datos_completos: true
      }, { transaction });

      console.log(`✅ [GUARDAR CLIENTE] Cliente creado:`, {
        id_cliente: cliente.id_cliente,
        rut: cliente.rut,
        razon_social: cliente.razon_social
      });

      await transaction.commit();

      return res.json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: {
          id_cliente: cliente.id_cliente,
          rut: cliente.rut,
          razon_social: cliente.razon_social,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          giro: cliente.giro,
          email: cliente.email,
          telefono: cliente.telefono
        }
      });
    } else {
      // Actualizar cliente existente
      // Determinar si es empresa o persona: si tiene giro, es empresa
      const esEmpresa = !!(giro && giro.trim());

      await cliente.update({
        tipo_cliente: esEmpresa ? 'empresa' : 'persona',
        razon_social: esEmpresa ? razon_social : null,
        nombre: razon_social,
        telefono: telefono || cliente.telefono,
        email: correo || cliente.email,
        direccion,
        comuna,
        giro: esEmpresa ? giro : null,
        datos_completos: true
      }, { transaction });

      console.log(`✅ [GUARDAR CLIENTE] Cliente actualizado:`, {
        id_cliente: cliente.id_cliente,
        rut: cliente.rut,
        razon_social: cliente.razon_social
      });

      await transaction.commit();

      return res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: {
          id_cliente: cliente.id_cliente,
          rut: cliente.rut,
          razon_social: cliente.razon_social,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          giro: cliente.giro,
          email: cliente.email,
          telefono: cliente.telefono
        }
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error('❌ [GUARDAR CLIENTE] Error:', error);
    next(error);
  }
});


/**
 * @openapi
 * /cajero/vale/{numeroVale}/actualizar-precios:
 *   put:
 *     summary: Actualizar precios de productos en un vale pendiente
 *     parameters:
 *       - in: path
 *         name: numeroVale
 *         required: true
 *         schema:
 *           type: string
 *         description: Número del vale (puede ser diario o completo)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualizaciones
 *             properties:
 *               actualizaciones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - index
 *                     - precio
 *                   properties:
 *                     index:
 *                       type: integer
 *                       description: Índice del producto en el array de detalles
 *                     precio:
 *                       type: number
 *                       description: Nuevo precio unitario
 *     responses:
 *       200:
 *         description: Precios actualizados exitosamente
 *       400:
 *         description: Error de validación
 *       404:
 *         description: Vale no encontrado
 */
router.put('/vale/:numeroVale/actualizar-precios', [
  param('numeroVale').isString().notEmpty().withMessage('Número de vale requerido'),
  body('actualizaciones').isArray().withMessage('Se requiere un array de actualizaciones'),
  body('actualizaciones.*.index').isInt({ min: 0 }).withMessage('Índice debe ser un número entero no negativo'),
  body('actualizaciones.*.precio').isNumeric().custom((value) => value > 0).withMessage('Precio debe ser mayor a 0'),
  handleValidationErrors
], async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { numeroVale } = req.params;
    const { actualizaciones } = req.body;
    
    // ✅ Obtener ID del cajero
    const id_cajero = (req as any).user?.id;
    
    if (!id_cajero) {
      await transaction.rollback();
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }
    
    console.log(`📝 Actualizando precios del vale: ${numeroVale}`);
    console.log(`📋 Actualizaciones solicitadas:`, actualizaciones);
    
    // 1. Verificar turno abierto
    const turnoActivo = await TurnoCaja.findOne({ 
      where: { id_cajero, estado: 'abierto' }, 
      transaction 
    });
    
    if (!turnoActivo) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No tienes un turno de caja abierto' 
      });
    }
    
    // 2. Buscar el vale usando la función helper
    const resultadoBusqueda = await buscarValePorNumero(numeroVale, transaction);
    
    if (!resultadoBusqueda.encontrado) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: resultadoBusqueda.mensaje || `Vale ${numeroVale} no encontrado`
      });
    }
    
    // 3. Obtener el vale completo con detalles
    const vale = await Pedido.findOne({
      where: { 
        numero_pedido: resultadoBusqueda.numero_pedido,
        estado: 'vale_pendiente' // Solo vales pendientes
      },
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
            }
          ]
        }
      ],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (!vale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Vale ${numeroVale} no encontrado o ya fue procesado`
      });
    }
    
    // 4. Validar índices
    const detalles = vale.detalles || [];
    for (const update of actualizaciones) {
      if (update.index >= detalles.length) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Índice ${update.index} fuera de rango. El vale tiene ${detalles.length} productos`
        });
      }
    }
    
    // 5. Aplicar actualizaciones
    let cambiosRealizados = 0;
    const cambiosLog: any[] = [];
    const subtotalAnterior = vale.subtotal;
    
    for (const update of actualizaciones) {
      const detalle = detalles[update.index];
      const precioAnterior = detalle.precio_unitario;
      
      // Actualizar precio en el detalle
      await detalle.update({
        precio_unitario: update.precio,
        subtotal: detalle.cantidad * update.precio
      }, { transaction });
      
      cambiosRealizados++;
      cambiosLog.push({
        index: update.index,
        producto: detalle.varianteProducto?.producto?.nombre || 'Producto',
        descripcion: [
          detalle.varianteProducto?.color,
          detalle.varianteProducto?.medida
        ].filter(Boolean).join(' - '),
        cantidad: detalle.cantidad,
        precio_anterior: precioAnterior,
        precio_nuevo: update.precio,
        diferencia_unitaria: update.precio - precioAnterior,
        diferencia_total: (update.precio - precioAnterior) * detalle.cantidad
      });
    }
    
    // 6. Recalcular totales del pedido
 // 6. Recalcular totales del pedido
let nuevoSubtotal = 0;

// Recorrer todos los detalles y usar el precio actualizado si corresponde
for (let i = 0; i < detalles.length; i++) {
  const actualizacion = actualizaciones.find((u: { index: number; precio: number }) => u.index === i);
  if (actualizacion) {
    // Usar el precio actualizado
    nuevoSubtotal += detalles[i].cantidad * actualizacion.precio;
  } else {
    // Usar el precio original
    nuevoSubtotal += Number(detalles[i].subtotal);
  }
}

const nuevoTotal = nuevoSubtotal - (vale.descuento || 0);
    
    // 7. Actualizar pedido
    await vale.update({
      subtotal: nuevoSubtotal,
      total: nuevoTotal,
      fecha_actualizacion: new Date(),
      observaciones: [
        vale.observaciones,
        `[PRECIOS ACTUALIZADOS POR CAJERO ID:${id_cajero} - ${new Date().toLocaleString('es-CL')}]`,
        `[${cambiosRealizados} precios modificados - Diferencia total: $${(nuevoTotal - vale.total).toLocaleString('es-CL')}]`
      ].filter(Boolean).join('\n')
    }, { transaction });
    
    // 8. Commit de la transacción
    await transaction.commit();
    
    console.log(`✅ Precios actualizados exitosamente:`, {
      vale: numeroVale,
      cambios: cambiosRealizados,
      total_anterior: vale.total,
      total_nuevo: nuevoTotal
    });
    
    // 9. Respuesta exitosa
    res.json({
      success: true,
      message: `Se actualizaron ${cambiosRealizados} precios correctamente`,
      data: {
        numero_vale: vale.numero_pedido,
        cambios_realizados: cambiosRealizados,
        total_anterior: vale.total,
        total_nuevo: nuevoTotal,
        diferencia_total: nuevoTotal - vale.total,
        detalle_cambios: cambiosLog,
        resumen: {
          productos_actualizados: cambiosRealizados,
          aumento_total: cambiosLog.reduce((sum, c) => sum + c.diferencia_total, 0)
        }
      }
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error actualizando precios:', error);
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

// ✅ ======================================================================
// ✅ NUEVOS ENDPOINTS: REPORTES PARA CAJERO
// ✅ ======================================================================

/**
 * @openapi
 * /cajero/reportes/vales-cobrados:
 *   get:
 *     summary: Obtener historial de vales cobrados (completados) con filtros
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio del rango (opcional, por defecto hoy)
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin del rango (opcional, por defecto hoy)
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cantidad máxima de resultados
 */
router.get('/reportes/vales-cobrados', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fechaInicioParam = req.query.fecha_inicio as string;
    const fechaFinParam = req.query.fecha_fin as string;
    const limiteParam = req.query.limite as string;

    // Valores por defecto: día actual
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInicio = fechaInicioParam || hoy;
    const fechaFin = fechaFinParam || hoy;
    const limite = limiteParam ? parseInt(limiteParam) : 50;

    console.log(`📊 Obteniendo vales cobrados desde ${fechaInicio} hasta ${fechaFin}`);

    // Buscar vales completados con sus ventas asociadas
    const valesCobrados = await sequelize.query(`
      SELECT
        p.id_pedido,
        p.numero_pedido,
        p.numero_diario,
        p.fecha_creacion,
        p.fecha_actualizacion,
        p.tipo_documento,
        p.total as total_vale,
        p.descuento,
        p.observaciones,
        v.numero_venta,
        v.total as total_venta,
        v.nombre_cliente,
        v.rut_cliente,
        v.razon_social,
        c.nombre as cliente_nombre,
        c.rut as cliente_rut,
        c.tipo_cliente,
        u.nombre_completo as vendedor_nombre,
        u.usuario as vendedor_usuario,
        tc.id_turno,
        DATE(p.fecha_creacion) as fecha_cobro,
        TIME(p.fecha_actualizacion) as hora_cobro,
        DATEDIFF(p.fecha_actualizacion, p.fecha_creacion) as dias_para_cobrar
      FROM pedidos p
      INNER JOIN ventas v ON v.id_pedido = p.id_pedido
      LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
      LEFT JOIN usuarios u ON u.id_usuario = p.id_vendedor
      LEFT JOIN turnos_caja tc ON tc.id_turno = v.id_turno
      WHERE p.estado = 'completado'
        AND DATE(p.fecha_actualizacion) BETWEEN :fechaInicio AND :fechaFin
      ORDER BY p.fecha_actualizacion DESC
      LIMIT :limite
    `, {
      replacements: { fechaInicio, fechaFin, limite },
      type: QueryTypes.SELECT
    });

    // Calcular estadísticas del reporte
    const totalCobrado = valesCobrados.reduce((sum: number, vale: any) =>
      sum + Number(vale.total_venta || 0), 0
    );
    const totalDescuentos = valesCobrados.reduce((sum: number, vale: any) =>
      sum + Number(vale.descuento || 0), 0
    );

    // Agrupar por tipo de documento
    const porTipoDocumento = valesCobrados.reduce((acc: any, vale: any) => {
      const tipo = vale.tipo_documento || 'sin_especificar';
      if (!acc[tipo]) {
        acc[tipo] = { cantidad: 0, monto_total: 0 };
      }
      acc[tipo].cantidad++;
      acc[tipo].monto_total += Number(vale.total_venta || 0);
      return acc;
    }, {});

    // Agrupar por día
    const porDia = valesCobrados.reduce((acc: any, vale: any) => {
      const fecha = vale.fecha_cobro;
      if (!acc[fecha]) {
        acc[fecha] = { cantidad: 0, monto_total: 0, descuentos: 0 };
      }
      acc[fecha].cantidad++;
      acc[fecha].monto_total += Number(vale.total_venta || 0);
      acc[fecha].descuentos += Number(vale.descuento || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        vales: valesCobrados.map((vale: any) => ({
          id_pedido: vale.id_pedido,
          numero_pedido: vale.numero_pedido,
          numero_diario: vale.numero_diario,
          numero_display: vale.numero_diario
            ? `#${String(vale.numero_diario).padStart(3, '0')}`
            : vale.numero_pedido,
          numero_venta: vale.numero_venta,
          fecha_creacion: vale.fecha_creacion,
          fecha_cobro: vale.fecha_actualizacion,
          hora_cobro: vale.hora_cobro,
          dias_para_cobrar: vale.dias_para_cobrar,
          tipo_documento: vale.tipo_documento,
          total_vale: Number(vale.total_vale),
          descuento: Number(vale.descuento),
          total_venta: Number(vale.total_venta),
          cliente: {
            nombre: vale.razon_social || vale.nombre_cliente || vale.cliente_nombre || 'Cliente sin datos',
            rut: vale.rut_cliente || vale.cliente_rut,
            tipo: vale.tipo_cliente
          },
          vendedor: {
            nombre: vale.vendedor_nombre,
            usuario: vale.vendedor_usuario
          },
          id_turno: vale.id_turno,
          observaciones: vale.observaciones
        })),
        resumen: {
          periodo: {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
          },
          totales: {
            cantidad_vales: valesCobrados.length,
            monto_total_cobrado: totalCobrado,
            descuentos_aplicados: totalDescuentos,
            monto_sin_descuentos: totalCobrado + totalDescuentos
          },
          por_tipo_documento: porTipoDocumento,
          por_dia: porDia
        }
      },
      message: `Se encontraron ${valesCobrados.length} vales cobrados`
    });

  } catch (error) {
    console.error('❌ Error obteniendo vales cobrados:', error);
    next(error);
  }
});

/**
 * @openapi
 * /cajero/reportes/vales-por-cobrar:
 *   get:
 *     summary: Obtener vales pendientes de cobro con información del cliente
 *     parameters:
 *       - in: query
 *         name: dias_atras
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Cantidad de días hacia atrás para buscar vales pendientes
 *       - in: query
 *         name: solo_con_cliente
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filtrar solo vales que tienen cliente asociado
 */
router.get('/reportes/vales-por-cobrar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diasAtrasParam = req.query.dias_atras as string;
    const soloConClienteParam = req.query.solo_con_cliente as string;

    const diasAtras = diasAtrasParam ? parseInt(diasAtrasParam) : 30;
    const soloConCliente = soloConClienteParam === 'true';

    console.log(`📊 Obteniendo vales pendientes de cobro (últimos ${diasAtras} días)`);

    // Construir query base
    let query = `
      SELECT
        p.id_pedido,
        p.numero_pedido,
        p.numero_diario,
        p.fecha_creacion,
        p.fecha_actualizacion,
        p.tipo_documento,
        p.total,
        p.descuento,
        p.subtotal,
        p.estado,
        p.observaciones,
        p.datos_completos,
        c.id_cliente,
        c.rut as cliente_rut,
        c.nombre as cliente_nombre,
        c.razon_social as cliente_razon_social,
        c.telefono as cliente_telefono,
        c.email as cliente_email,
        c.direccion as cliente_direccion,
        c.comuna as cliente_comuna,
        c.tipo_cliente,
        c.datos_completos as cliente_datos_completos,
        u.nombre_completo as vendedor_nombre,
        u.usuario as vendedor_usuario,
        DATE(p.fecha_creacion) as fecha_vale,
        TIME(p.fecha_creacion) as hora_vale,
        DATEDIFF(CURDATE(), DATE(p.fecha_creacion)) as dias_pendiente
      FROM pedidos p
      LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
      LEFT JOIN usuarios u ON u.id_usuario = p.id_vendedor
      WHERE p.estado IN ('vale_pendiente', 'procesando_caja')
        AND p.fecha_creacion >= DATE_SUB(CURDATE(), INTERVAL :diasAtras DAY)
    `;

    if (soloConCliente) {
      query += ` AND p.id_cliente IS NOT NULL`;
    }

    query += `
      ORDER BY
        CASE
          WHEN p.id_cliente IS NOT NULL THEN 0
          ELSE 1
        END,
        p.fecha_creacion ASC
    `;

    const valesPendientes = await sequelize.query(query, {
      replacements: { diasAtras },
      type: QueryTypes.SELECT
    });

    // Calcular estadísticas
    const totalPendiente = valesPendientes.reduce((sum: number, vale: any) =>
      sum + Number(vale.total || 0), 0
    );

    const conCliente = valesPendientes.filter((v: any) => v.id_cliente);
    const sinCliente = valesPendientes.filter((v: any) => !v.id_cliente);

    // Agrupar por cliente
    const porCliente = valesPendientes
      .filter((v: any) => v.id_cliente)
      .reduce((acc: any, vale: any) => {
        const rut = vale.cliente_rut || 'sin_rut';
        if (!acc[rut]) {
          acc[rut] = {
            cliente: {
              rut: vale.cliente_rut,
              nombre: vale.cliente_razon_social || vale.cliente_nombre,
              telefono: vale.cliente_telefono,
              email: vale.cliente_email,
              direccion: vale.cliente_direccion,
              comuna: vale.cliente_comuna,
              tipo: vale.tipo_cliente,
              datos_completos: vale.cliente_datos_completos
            },
            vales: [],
            cantidad_vales: 0,
            monto_total: 0
          };
        }
        acc[rut].vales.push({
          numero_pedido: vale.numero_pedido,
          numero_diario: vale.numero_diario,
          fecha_creacion: vale.fecha_creacion,
          dias_pendiente: vale.dias_pendiente,
          total: Number(vale.total),
          tipo_documento: vale.tipo_documento
        });
        acc[rut].cantidad_vales++;
        acc[rut].monto_total += Number(vale.total);
        return acc;
      }, {});

    // Convertir a array y ordenar por monto descendente
    const clientesConDeuda = Object.values(porCliente)
      .sort((a: any, b: any) => b.monto_total - a.monto_total);

    // Agrupar por antigüedad
    const porAntiguedad = {
      hoy: valesPendientes.filter((v: any) => v.dias_pendiente === 0).length,
      ayer: valesPendientes.filter((v: any) => v.dias_pendiente === 1).length,
      ultimos_7_dias: valesPendientes.filter((v: any) => v.dias_pendiente >= 2 && v.dias_pendiente <= 7).length,
      ultimos_30_dias: valesPendientes.filter((v: any) => v.dias_pendiente >= 8 && v.dias_pendiente <= 30).length,
      mas_de_30_dias: valesPendientes.filter((v: any) => v.dias_pendiente > 30).length
    };

    res.json({
      success: true,
      data: {
        vales: valesPendientes.map((vale: any) => ({
          id_pedido: vale.id_pedido,
          numero_pedido: vale.numero_pedido,
          numero_diario: vale.numero_diario,
          numero_display: vale.numero_diario
            ? `#${String(vale.numero_diario).padStart(3, '0')}`
            : vale.numero_pedido,
          fecha_creacion: vale.fecha_creacion,
          fecha_vale: vale.fecha_vale,
          hora_vale: vale.hora_vale,
          dias_pendiente: vale.dias_pendiente,
          estado: vale.estado,
          tipo_documento: vale.tipo_documento,
          total: Number(vale.total),
          descuento: Number(vale.descuento),
          subtotal: Number(vale.subtotal),
          datos_completos: vale.datos_completos,
          cliente: vale.id_cliente ? {
            id_cliente: vale.id_cliente,
            rut: vale.cliente_rut,
            nombre: vale.cliente_razon_social || vale.cliente_nombre || 'Sin nombre',
            razon_social: vale.cliente_razon_social,
            telefono: vale.cliente_telefono,
            email: vale.cliente_email,
            direccion: vale.cliente_direccion,
            comuna: vale.cliente_comuna,
            tipo: vale.tipo_cliente,
            datos_completos: vale.cliente_datos_completos
          } : null,
          vendedor: {
            nombre: vale.vendedor_nombre,
            usuario: vale.vendedor_usuario
          },
          observaciones: vale.observaciones,
          prioridad: vale.dias_pendiente > 7 ? 'alta' : vale.dias_pendiente > 3 ? 'media' : 'normal'
        })),
        resumen: {
          periodo: {
            dias_consultados: diasAtras,
            filtro_aplicado: soloConCliente ? 'Solo vales con cliente' : 'Todos los vales'
          },
          totales: {
            cantidad_total: valesPendientes.length,
            monto_total_pendiente: totalPendiente,
            con_cliente: conCliente.length,
            sin_cliente: sinCliente.length,
            monto_con_cliente: conCliente.reduce((sum: number, v: any) => sum + Number(v.total || 0), 0),
            monto_sin_cliente: sinCliente.reduce((sum: number, v: any) => sum + Number(v.total || 0), 0)
          },
          por_antiguedad: porAntiguedad,
          clientes_con_deuda: clientesConDeuda,
          alertas: [
            ...(porAntiguedad.mas_de_30_dias > 0 ? [{
              tipo: 'error' as const,
              mensaje: `Hay ${porAntiguedad.mas_de_30_dias} vales con más de 30 días pendientes`,
              prioridad: 'alta' as const
            }] : []),
            ...(conCliente.length === 0 && valesPendientes.length > 0 ? [{
              tipo: 'warning' as const,
              mensaje: 'No hay vales con cliente asociado. Dificulta seguimiento de cobranza',
              prioridad: 'media' as const
            }] : [])
          ]
        }
      },
      message: `Se encontraron ${valesPendientes.length} vales pendientes de cobro`
    });

  } catch (error) {
    console.error('❌ Error obteniendo vales por cobrar:', error);
    next(error);
  }
});

/**
 * @openapi
 * /cajero/reportes/resumen-del-dia:
 *   get:
 *     summary: Obtener resumen completo del día actual con todas las métricas
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha del reporte (opcional, por defecto hoy)
 */
router.get('/reportes/resumen-del-dia', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fechaParam = req.query.fecha as string;
    const fecha = fechaParam || new Date().toISOString().split('T')[0];

    console.log(`📊 Generando resumen del día: ${fecha}`);

    // Obtener todos los vales del día
    const valesDelDia = await sequelize.query(`
      SELECT
        p.id_pedido,
        p.numero_pedido,
        p.numero_diario,
        p.estado,
        p.tipo_documento,
        p.total,
        p.descuento,
        p.fecha_creacion,
        p.fecha_actualizacion,
        v.numero_venta,
        v.total as total_venta,
        c.nombre as cliente_nombre,
        c.rut as cliente_rut,
        u.nombre_completo as vendedor_nombre,
        TIME(p.fecha_creacion) as hora_creacion,
        CASE
          WHEN p.estado = 'completado' THEN TIME(p.fecha_actualizacion)
          ELSE NULL
        END as hora_cobro
      FROM pedidos p
      LEFT JOIN ventas v ON v.id_pedido = p.id_pedido
      LEFT JOIN clientes c ON c.id_cliente = p.id_cliente
      LEFT JOIN usuarios u ON u.id_usuario = p.id_vendedor
      WHERE DATE(p.fecha_creacion) = :fecha
      ORDER BY p.fecha_creacion ASC
    `, {
      replacements: { fecha },
      type: QueryTypes.SELECT
    });

    // Clasificar vales
    const completados = valesDelDia.filter((v: any) => v.estado === 'completado');
    const pendientes = valesDelDia.filter((v: any) => v.estado === 'vale_pendiente');
    const procesando = valesDelDia.filter((v: any) => v.estado === 'procesando_caja');
    const cancelados = valesDelDia.filter((v: any) => v.estado === 'cancelado');

    // Calcular totales
    const totalRecaudado = completados.reduce((sum: number, v: any) =>
      sum + Number(v.total_venta || 0), 0
    );
    const totalPendiente = pendientes.reduce((sum: number, v: any) =>
      sum + Number(v.total || 0), 0
    );
    const totalDescuentos = completados.reduce((sum: number, v: any) =>
      sum + Number(v.descuento || 0), 0
    );

    // Agrupar por hora
    const porHora = valesDelDia.reduce((acc: any, vale: any) => {
      const hora = vale.hora_creacion ? vale.hora_creacion.substring(0, 2) : '00';
      if (!acc[hora]) {
        acc[hora] = { cantidad: 0, completados: 0, pendientes: 0, monto: 0 };
      }
      acc[hora].cantidad++;
      if (vale.estado === 'completado') {
        acc[hora].completados++;
        acc[hora].monto += Number(vale.total_venta || 0);
      } else if (vale.estado === 'vale_pendiente') {
        acc[hora].pendientes++;
      }
      return acc;
    }, {});

    // Agrupar por vendedor
    const porVendedor = valesDelDia.reduce((acc: any, vale: any) => {
      const vendedor = vale.vendedor_nombre || 'Sin asignar';
      if (!acc[vendedor]) {
        acc[vendedor] = {
          cantidad: 0,
          completados: 0,
          pendientes: 0,
          monto_total: 0,
          monto_pendiente: 0
        };
      }
      acc[vendedor].cantidad++;
      if (vale.estado === 'completado') {
        acc[vendedor].completados++;
        acc[vendedor].monto_total += Number(vale.total_venta || 0);
      } else if (vale.estado === 'vale_pendiente') {
        acc[vendedor].pendientes++;
        acc[vendedor].monto_pendiente += Number(vale.total || 0);
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        fecha: fecha,
        resumen_general: {
          total_vales: valesDelDia.length,
          completados: completados.length,
          pendientes: pendientes.length,
          procesando: procesando.length,
          cancelados: cancelados.length,
          eficiencia: valesDelDia.length > 0
            ? Math.round((completados.length / valesDelDia.length) * 100)
            : 100
        },
        montos: {
          total_recaudado: totalRecaudado,
          total_pendiente: totalPendiente,
          total_descuentos: totalDescuentos,
          total_sin_descuentos: totalRecaudado + totalDescuentos,
          promedio_por_vale: completados.length > 0
            ? totalRecaudado / completados.length
            : 0
        },
        por_hora: Object.entries(porHora).map(([hora, datos]: [string, any]) => ({
          hora: `${hora}:00`,
          ...datos
        })).sort((a, b) => a.hora.localeCompare(b.hora)),
        por_vendedor: Object.entries(porVendedor).map(([vendedor, datos]: [string, any]) => ({
          vendedor,
          ...datos
        })).sort((a: any, b: any) => b.monto_total - a.monto_total),
        vales_destacados: {
          primer_vale: valesDelDia[0] ? {
            numero: (valesDelDia[0] as any).numero_pedido,
            hora: (valesDelDia[0] as any).hora_creacion,
            vendedor: (valesDelDia[0] as any).vendedor_nombre
          } : null,
          ultimo_vale: valesDelDia[valesDelDia.length - 1] ? {
            numero: (valesDelDia[valesDelDia.length - 1] as any).numero_pedido,
            hora: (valesDelDia[valesDelDia.length - 1] as any).hora_creacion,
            vendedor: (valesDelDia[valesDelDia.length - 1] as any).vendedor_nombre
          } : null,
          vale_mayor_monto: completados.length > 0
            ? completados.reduce((max: any, v: any) =>
                Number(v.total_venta) > Number(max.total_venta) ? v : max
              )
            : null
        }
      },
      message: `Resumen del día ${fecha} generado exitosamente`
    });

  } catch (error) {
    console.error('❌ Error generando resumen del día:', error);
    next(error);
  }
});

// ============================================================================
// ENDPOINTS DE GESTIÓN DE CLIENTES
// ============================================================================

/**
 * GET /cajero/clientes
 * Obtener TODOS los clientes con sus totales y vales
 */
router.get('/clientes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('📋 Obteniendo todos los clientes con sus vales...');

    // Obtener todos los clientes
    const clientes = await Cliente.findAll({
      where: { activo: true },
      order: [['nombre', 'ASC']]
    });

    // Para cada cliente, calcular sus totales
    const clientesConTotales = await Promise.all(
      clientes.map(async (cliente) => {
        // Obtener todos los pedidos del cliente
        const pedidos = await Pedido.findAll({
          where: {
            id_cliente: cliente.id_cliente,
            estado: { [Op.in]: ['pendiente', 'completado'] }
          },
          attributes: ['id_pedido', 'numero_pedido', 'estado', 'total']
        });

        // Separar pendientes y pagados
        const pendientes = pedidos.filter(p => p.estado === 'pendiente');
        const pagados = pedidos.filter(p => p.estado === 'completado');

        // Calcular totales (NETO)
        const total_pendiente = pendientes.reduce((sum, p) => sum + Number(p.total), 0);
        const total_pagado = pagados.reduce((sum, p) => sum + Number(p.total), 0);
        const total_comprado = total_pendiente + total_pagado;

        return {
          nombre: cliente.getNombreCompleto(),
          rut: cliente.rut,
          telefono: cliente.telefono || '',
          direccion: cliente.direccion || '',
          comuna: cliente.comuna || '',
          razon_social: cliente.razon_social || '',
          email: cliente.email || '',
          total_comprado: Math.round(total_comprado),
          total_pendiente: Math.round(total_pendiente),
          total_pagado: Math.round(total_pagado),
          vales_pendientes: pendientes.length,
          vales_pagados: pagados.length
        };
      })
    );

    res.json({
      success: true,
      data: clientesConTotales
    });

  } catch (error) {
    console.error('❌ Error obteniendo clientes:', error);
    next(error);
  }
});

/**
 * GET /cajero/clientes/:rut/vales
 * Obtener vales de un cliente específico (pendientes y pagados)
 */
router.get('/clientes/:rut/vales', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { rut } = req.params;
    console.log(`📋 Obteniendo vales del cliente con RUT original: ${rut}`);

    // Normalizar el RUT: si viene sin guión, agregarlo
    // Formato esperado: 12345678-9
    if (!rut.includes('-') && rut.length >= 2) {
      const rutSinDV = rut.slice(0, -1);
      const dv = rut.slice(-1);
      rut = `${rutSinDV}-${dv}`;
      console.log(`🔄 RUT normalizado a: ${rut}`);
    }

    // Buscar cliente por RUT (con guión)
    const cliente = await Cliente.findOne({
      where: { rut: rut }
    });

    if (!cliente) {
      console.log(`❌ Cliente con RUT ${rut} no encontrado`);
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    console.log(`✅ Cliente encontrado: ${cliente.getNombreCompleto()} (ID: ${cliente.id_cliente})`);

    // Obtener todos los pedidos del cliente
    console.log(`🔍 Buscando pedidos del cliente ID: ${cliente.id_cliente}`);
    const pedidos = await Pedido.findAll({
      where: {
        id_cliente: cliente.id_cliente,
        estado: { [Op.in]: ['pendiente', 'completado'] }
      },
      attributes: ['id_pedido', 'numero_pedido', 'estado', 'total', 'fecha_creacion'],
      include: [
        {
          model: Venta,
          as: 'venta',
          required: false,
          attributes: ['fecha_venta']
        }
      ],
      order: [['fecha_creacion', 'DESC']]
    });

    console.log(`📊 Pedidos encontrados: ${pedidos.length}`);

    // Separar pendientes y pagados
    const pendientes = pedidos
      .filter(p => p.estado === 'pendiente')
      .map(p => ({
        numero_pedido: p.numero_pedido,
        fecha_creacion: p.fecha_creacion,
        total: Math.round(Number(p.total))
      }));

    const pagados = pedidos
      .filter(p => p.estado === 'completado')
      .map(p => ({
        numero_pedido: p.numero_pedido,
        fecha_creacion: p.fecha_creacion,
        fecha_pago: (p as any).venta?.fecha_venta || null,
        total: Math.round(Number(p.total))
      }));

    res.json({
      success: true,
      data: {
        pendientes,
        pagados
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo vales del cliente:', error);
    next(error);
  }
});

export default router;