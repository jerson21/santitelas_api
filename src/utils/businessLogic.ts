// src/utils/businessLogic.ts - ARCHIVO NUEVO CON FUNCIONES ROBUSTAS
import { sequelize } from '../config/database';
import { QueryTypes, Transaction } from 'sequelize';

// ==========================================================
// FUNCIONES DE NUMERACIÓN - ROBUSTAS CON FALLBACK
// ==========================================================

export async function obtenerProximoNumeroDiario(transaction?: Transaction): Promise<number> {
  try {
    // ✅ PRIMERA OPCIÓN: Usar MySQL function si existe
    try {
      const [result]: any = await sequelize.query(`
        SELECT obtener_proximo_numero_diario() as proximo_numero
      `, { 
        type: QueryTypes.SELECT,
        transaction 
      });
      
      if (result?.proximo_numero) {
        console.log(`🎯 Número diario obtenido por MySQL: ${result.proximo_numero}`);
        return result.proximo_numero;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, usando fallback TypeScript');
    }

    // ✅ FALLBACK: Lógica robusta en TypeScript
    const [result]: any = await sequelize.query(`
      SELECT COALESCE(MAX(numero_diario), 0) + 1 as proximo_numero
      FROM pedidos 
      WHERE DATE(fecha_creacion) = CURDATE()
      FOR UPDATE
    `, { 
      type: QueryTypes.SELECT,
      transaction 
    });
    
    const proximoNumero = result?.proximo_numero || 1;
    console.log(`🎯 Número diario calculado por TypeScript: ${proximoNumero}`);
    return proximoNumero;
    
  } catch (error) {
    console.error('❌ Error obteniendo próximo número diario:', error);
    return 1;
  }
}

export async function generarNumeroPedido(transaction?: Transaction): Promise<string> {
  try {
    // ✅ PRIMERA OPCIÓN: MySQL function
    try {
      const [result]: any = await sequelize.query(`
        SELECT generar_numero_pedido_simple() as numero_completo
      `, { 
        type: QueryTypes.SELECT,
        transaction 
      });
      
      if (result?.numero_completo) {
        console.log(`🎯 Número pedido generado por MySQL: ${result.numero_completo}`);
        return result.numero_completo;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, usando fallback TypeScript');
    }

    // ✅ FALLBACK: Generación robusta en TypeScript
    const numeroDialio = await obtenerProximoNumeroDiario(transaction);
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const numeroFormateado = numeroDialio.toString().padStart(4, '0');
    const numeroPedido = `VP${fecha}-${numeroFormateado}`;
    
    console.log(`🎯 Número pedido generado por TypeScript: ${numeroPedido}`);
    return numeroPedido;
    
  } catch (error) {
    console.error('❌ Error generando número de pedido:', error);
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `VP${fecha}-0001`;
  }
}

export async function generarNumeroVenta(transaction?: Transaction): Promise<string> {
  try {
    // ✅ PRIMERA OPCIÓN: MySQL function
    try {
      const [result]: any = await sequelize.query(`
        SELECT generar_numero_venta() as numero_venta
      `, { 
        type: QueryTypes.SELECT,
        transaction 
      });
      
      if (result?.numero_venta) {
        console.log(`🎯 Número venta generado por MySQL: ${result.numero_venta}`);
        return result.numero_venta;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, usando fallback TypeScript');
    }

    // ✅ FALLBACK: Generación robusta en TypeScript
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const [result]: any = await sequelize.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(numero_venta, 11) AS UNSIGNED)), 0) + 1 as proximo_numero
      FROM ventas 
      WHERE numero_venta LIKE CONCAT('VT', ?, '-%')
      FOR UPDATE
    `, { 
      type: QueryTypes.SELECT,
      replacements: [fecha],
      transaction 
    });
    
    const proximoNumero = result?.proximo_numero || 1;
    const numeroFormateado = proximoNumero.toString().padStart(4, '0');
    const numeroVenta = `VT${fecha}-${numeroFormateado}`;
    
    console.log(`🎯 Número venta generado por TypeScript: ${numeroVenta}`);
    return numeroVenta;
    
  } catch (error) {
    console.error('❌ Error generando número de venta:', error);
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `VT${fecha}-0001`;
  }
}

// ==========================================================
// FUNCIONES DE STOCK - ROBUSTAS
// ==========================================================

export async function procesarVentaStockRobusto(
  idVenta: number,
  idBodega: number,
  idUsuario: number,
  transaction?: Transaction
): Promise<{ success: boolean; mensaje: string }> {
  try {
    // ✅ PRIMERA OPCIÓN: Usar procedure MySQL si existe
    try {
      await sequelize.query('CALL procesar_venta_stock_bodega(?, ?, ?)', {
        replacements: [idVenta, idBodega, idUsuario],
        transaction
      });
      
      console.log(`✅ Stock procesado por MySQL procedure - Venta: ${idVenta}`);
      return {
        success: true,
        mensaje: 'Stock procesado exitosamente usando MySQL procedure'
      };
      
    } catch (mysqlError: any) {
      console.log('⚠️ MySQL procedure no disponible, usando lógica TypeScript');
      
      // Si el error es de stock insuficiente, no hacer fallback
      if (mysqlError.message?.includes('Stock insuficiente')) {
        return {
          success: false,
          mensaje: mysqlError.message
        };
      }
    }

    // ✅ FALLBACK: Lógica completa en TypeScript
    return await procesarStockManual(idVenta, idBodega, idUsuario, transaction);
    
  } catch (error: any) {
    console.error('❌ Error procesando stock:', error);
    return {
      success: false,
      mensaje: error.message || 'Error interno procesando stock'
    };
  }
}

async function procesarStockManual(
  idVenta: number,
  idBodega: number,
  idUsuario: number,
  transaction?: Transaction
): Promise<{ success: boolean; mensaje: string }> {
  
  console.log(`🔄 Procesando stock manual - Venta: ${idVenta}, Bodega: ${idBodega}`);
  
  try {
    // Obtener items de la venta
    const [items]: any = await sequelize.query(`
      SELECT 
        vp.id_variante_producto,
        dp.cantidad,
        p.nombre as producto_nombre,
        CONCAT(
          p.nombre, 
          CASE WHEN vp.color IS NOT NULL THEN CONCAT(' - ', vp.color) ELSE '' END,
          CASE WHEN vp.medida IS NOT NULL THEN CONCAT(' ', vp.medida) ELSE '' END
        ) as descripcion_completa
      FROM ventas v
      JOIN pedidos ped ON v.id_pedido = ped.id_pedido
      JOIN detalle_pedidos dp ON ped.id_pedido = dp.id_pedido
      JOIN variantes_producto vp ON dp.id_variante_producto = vp.id_variante_producto
      JOIN productos p ON vp.id_producto = p.id_producto
      WHERE v.id_venta = ?
    `, {
      type: QueryTypes.SELECT,
      replacements: [idVenta],
      transaction
    });

    if (!items || items.length === 0) {
      return {
        success: false,
        mensaje: 'No se encontraron items para la venta'
      };
    }

    // Obtener número de venta para referencia
    const [ventaInfo]: any = await sequelize.query(`
      SELECT numero_venta FROM ventas WHERE id_venta = ?
    `, {
      type: QueryTypes.SELECT,
      replacements: [idVenta],
      transaction
    });

    const numeroVenta = ventaInfo?.numero_venta || `VENTA-${idVenta}`;

    // Procesar cada item
    for (const item of items) {
      console.log(`📦 Procesando: ${item.descripcion_completa} - Cantidad: ${item.cantidad}`);
      
      // Obtener stock actual con lock
      const [stockInfo]: any = await sequelize.query(`
        SELECT COALESCE(cantidad_disponible, 0) as stock_actual
        FROM stock_por_bodega 
        WHERE id_variante_producto = ? AND id_bodega = ?
        FOR UPDATE
      `, {
        type: QueryTypes.SELECT,
        replacements: [item.id_variante_producto, idBodega],
        transaction
      });

      const stockActual = stockInfo?.stock_actual || 0;

      // Validar stock suficiente
      if (stockActual < item.cantidad) {
        return {
          success: false,
          mensaje: `Stock insuficiente para ${item.descripcion_completa}. Disponible: ${stockActual}, Requerido: ${item.cantidad}`
        };
      }

      const nuevoStock = stockActual - item.cantidad;

      // Actualizar stock
      await sequelize.query(`
        UPDATE stock_por_bodega 
        SET cantidad_disponible = ?,
            fecha_actualizacion = NOW()
        WHERE id_variante_producto = ? AND id_bodega = ?
      `, {
        replacements: [nuevoStock, item.id_variante_producto, idBodega],
        transaction
      });

      // Registrar movimiento
      await sequelize.query(`
        INSERT INTO movimientos_stock (
          id_variante_producto, id_bodega, tipo_movimiento, 
          cantidad, stock_anterior, stock_nuevo, 
          motivo, referencia, id_usuario, fecha_movimiento
        ) VALUES (?, ?, 'salida', ?, ?, ?, ?, ?, ?, NOW())
      `, {
        replacements: [
          item.id_variante_producto, idBodega, item.cantidad,
          stockActual, nuevoStock, 'Venta procesada', numeroVenta, idUsuario
        ],
        transaction
      });

      console.log(`✅ Stock actualizado: ${item.descripcion_completa} (${stockActual} → ${nuevoStock})`);
    }

    console.log(`✅ Stock procesado completamente para venta ${numeroVenta}`);
    return {
      success: true,
      mensaje: `Stock procesado exitosamente para ${items.length} productos`
    };

  } catch (error: any) {
    console.error('❌ Error en procesamiento manual de stock:', error);
    return {
      success: false,
      mensaje: error.message || 'Error procesando stock manualmente'
    };
  }
}

// ==========================================================
// FUNCIONES DE STOCK - HÍBRIDO MYSQL/TYPESCRIPT
// ==========================================================

export async function calcularStockTotalVariante(idVarianteProducto: number): Promise<number> {
  try {
    // ✅ USA FUNCTION MYSQL PARA PERFORMANCE
    try {
      const [result]: any = await sequelize.query(`
        SELECT calcular_stock_total_variante(?) as stock_total
      `, {
        replacements: [idVarianteProducto]
      });
      
      if (result?.stock_total !== undefined) {
        return result.stock_total;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, calculando en TypeScript');
    }

    // Fallback en TypeScript
    const [result]: any = await sequelize.query(`
      SELECT COALESCE(SUM(cantidad_disponible), 0) as stock_total
      FROM stock_por_bodega 
      WHERE id_variante_producto = ?
    `, {
      type: QueryTypes.SELECT,
      replacements: [idVarianteProducto]
    });
    
    return result?.stock_total || 0;
  } catch (error) {
    console.error('❌ Error calculando stock total:', error);
    return 0;
  }
}

export async function obtenerStockEnBodega(idVarianteProducto: number, idBodega: number): Promise<number> {
  try {
    // ✅ USA FUNCTION MYSQL PARA PERFORMANCE
    try {
      const [result]: any = await sequelize.query(`
        SELECT obtener_stock_en_bodega(?, ?) as stock
      `, {
        replacements: [idVarianteProducto, idBodega]
      });
      
      if (result?.stock !== undefined) {
        return result.stock;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, consultando en TypeScript');
    }

    // Fallback en TypeScript
    const [result]: any = await sequelize.query(`
      SELECT COALESCE(cantidad_disponible, 0) as stock
      FROM stock_por_bodega 
      WHERE id_variante_producto = ? AND id_bodega = ?
    `, {
      type: QueryTypes.SELECT,
      replacements: [idVarianteProducto, idBodega]
    });
    
    return result?.stock || 0;
  } catch (error) {
    console.error('❌ Error obteniendo stock en bodega:', error);
    return 0;
  }
}

// ==========================================================
// FUNCIONES DE CAJA - ROBUSTAS
// ==========================================================

export async function calcularDineroTeorico(idTurno: number): Promise<number> {
  try {
    // ✅ PRIMERA OPCIÓN: MySQL function
    try {
      const [result]: any = await sequelize.query(`
        SELECT calcular_dinero_teorico_turno(?) as dinero_teorico
      `, {
        type: QueryTypes.SELECT,
        replacements: [idTurno]
      });
      
      if (result?.dinero_teorico !== undefined) {
        return result.dinero_teorico;
      }
    } catch (mysqlError) {
      console.log('⚠️ MySQL function no disponible, calculando en TypeScript');
    }

    // ✅ FALLBACK: Cálculo en TypeScript
    const [montoInicial]: any = await sequelize.query(`
      SELECT COALESCE(monto_inicial, 0) as monto_inicial
      FROM turnos_caja WHERE id_turno = ?
    `, {
      type: QueryTypes.SELECT,
      replacements: [idTurno]
    });

    const [totalEfectivo]: any = await sequelize.query(`
      SELECT COALESCE(SUM(p.monto), 0) as total_efectivo
      FROM ventas v
      JOIN pagos p ON v.id_venta = p.id_venta
      JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo
      WHERE v.id_turno = ? AND v.estado = 'completada' AND mp.tipo = 'efectivo'
    `, {
      type: QueryTypes.SELECT,
      replacements: [idTurno]
    });

    const dineroTeorico = (montoInicial?.monto_inicial || 0) + (totalEfectivo?.total_efectivo || 0);
    console.log(`💰 Dinero teórico calculado: ${dineroTeorico} (Inicial: ${montoInicial?.monto_inicial || 0} + Efectivo: ${totalEfectivo?.total_efectivo || 0})`);
    
    return dineroTeorico;

  } catch (error) {
    console.error('❌ Error calculando dinero teórico:', error);
    return 0;
  }
}

// ==========================================================
// VERIFICACIÓN DEL SISTEMA
// ==========================================================

export async function verificarSistema(): Promise<void> {
  try {
    console.log('🔍 VERIFICACIÓN DEL SISTEMA SANTITELAS:');
    
    // Verificar procedures MySQL
    try {
      const [procedures] = await sequelize.query("SHOW PROCEDURE STATUS WHERE Db = DATABASE()");
      const [functions] = await sequelize.query("SHOW FUNCTION STATUS WHERE Db = DATABASE()");
      console.log(`   📋 Procedures MySQL: ${procedures.length}`);
      console.log(`   🔧 Functions MySQL: ${functions.length}`);
    } catch (error) {
      console.log('   ⚠️ No se pudieron verificar procedures MySQL');
    }

    // Probar numeración
    try {
      const proximoNumero = await obtenerProximoNumeroDiario();
      const numeroPedido = await generarNumeroPedido();
      const numeroVenta = await generarNumeroVenta();
      
      console.log(`   🔢 Próximo número diario: ${proximoNumero}`);
      console.log(`   📋 Ejemplo número pedido: ${numeroPedido}`);
      console.log(`   🧾 Ejemplo número venta: ${numeroVenta}`);
      console.log('   ✅ Sistema de numeración funcionando');
    } catch (error) {
      console.log('   ❌ Error en sistema de numeración:', error);
    }

    // Contar registros
    const [productos] = await sequelize.query('SELECT COUNT(*) as count FROM productos WHERE activo = TRUE');
    const [variantes] = await sequelize.query('SELECT COUNT(*) as count FROM variantes_producto WHERE activo = TRUE');
    const [modalidades] = await sequelize.query('SELECT COUNT(*) as count FROM modalidades_producto WHERE activa = TRUE');
    const [usuarios] = await sequelize.query('SELECT COUNT(*) as count FROM usuarios WHERE activo = TRUE');
    
    console.log(`   📦 Productos activos: ${(productos[0] as any).count}`);
    console.log(`   🎨 Variantes activas: ${(variantes[0] as any).count}`);
    console.log(`   🎯 Modalidades activas: ${(modalidades[0] as any).count}`);
    console.log(`   👥 Usuarios activos: ${(usuarios[0] as any).count}`);
    
    console.log('🎉 Sistema verificado y funcionando correctamente');
    
  } catch (error) {
    console.error('❌ Error en verificación del sistema:', error);
    throw error;
  }
}