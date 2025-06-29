﻿// src/models/index.ts - CORREGIDO PARA INCLUIR ConfiguracionSistema
import { sequelize } from '../config/database';

// Importar modelos completos
import { Rol } from './Rol.model';
import { Usuario } from './Usuario.model';
import { Categoria } from './Categoria.model';
import { Producto } from './Producto.model';
import { VarianteProducto } from './VarianteProducto.model';
import { ModalidadProducto } from './ModalidadProducto.model';
import { Cliente } from './Cliente.model';
import { TipoDocumento } from './TipoDocumento.model';
import { Bodega } from './Bodega.model';
import { StockPorBodega } from './StockPorBodega.model';
import { Pedido } from './Pedido.model';
import { DetallePedido } from './DetallePedido.model';
import { MetodoPago } from './MetodoPago.model';
import { Caja } from './Caja.model';
import { TurnoCaja } from './TurnoCaja.model';
import { ArqueoCaja } from './ArqueoCaja.model';
import { Venta } from './Venta.model';
import { Pago } from './Pago.model';
import { MovimientoStock } from './MovimientoStock.model';
// ✅ AÑADIR ConfiguracionSistema
import { ConfiguracionSistema, ConfiguracionService } from './ConfiguracionSistema.model';

// Exportar modelos
export {
  Rol, Usuario, Categoria, Producto, VarianteProducto, ModalidadProducto,
  Cliente, TipoDocumento, Bodega, StockPorBodega, Pedido, DetallePedido,
  MetodoPago, Caja, TurnoCaja, ArqueoCaja, Venta, Pago, MovimientoStock,
  // ✅ EXPORTAR ConfiguracionSistema y Service
  ConfiguracionSistema, ConfiguracionService
};

export async function initializeModels() {
  try {
    console.log('📊 Registrando modelos en Sequelize...');
    
    // ✅ CORREGIDO: Registrar todos los modelos ANTES de cualquier operación
    sequelize.addModels([
      Rol, Usuario, Categoria, Producto, VarianteProducto, ModalidadProducto,
      Cliente, TipoDocumento, Bodega, StockPorBodega, Pedido, DetallePedido,
      MetodoPago, Caja, TurnoCaja, ArqueoCaja, Venta, Pago, MovimientoStock,
      // ✅ AÑADIR ConfiguracionSistema
      ConfiguracionSistema
    ]);

    // ✅ VERIFICAR que los modelos se registraron correctamente
    const registeredModels = Object.keys(sequelize.models);
    console.log('📋 Modelos registrados:', registeredModels.join(', '));
    
    // ✅ VERIFICAR modelo Usuario específicamente (importante para hooks)
    if (sequelize.models.Usuario) {
      console.log('✅ Modelo Usuario registrado correctamente');
      
      // ✅ VERIFICAR que los hooks están definidos
      const usuarioModel = sequelize.models.Usuario as any;
      if (usuarioModel.options?.hooks) {
        console.log('✅ Hooks detectados en modelo Usuario');
      } else {
        console.log('⚠️  No se detectaron hooks en modelo Usuario');
      }
    } else {
      throw new Error('❌ Modelo Usuario no se registró correctamente');
    }

    // ✅ VERIFICAR ConfiguracionSistema
    if (sequelize.models.ConfiguracionSistema) {
      console.log('✅ Modelo ConfiguracionSistema registrado correctamente');
    } else {
      console.log('⚠️  Modelo ConfiguracionSistema no se registró - verificar definición');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando modelos:', error);
    throw error;
  }
}

// ✅ ASOCIACIONES SIN CAMBIOS (están bien)
export function setupAssociations() {
  try {
    console.log('🔗 Configurando asociaciones para nueva estructura BD...');

    // Verificar que todos los modelos existen antes de crear asociaciones
    const models = sequelize.models;
    const requiredModels = [
      'Rol', 'Usuario', 'Categoria', 'Producto', 'VarianteProducto', 
      'ModalidadProducto', 'Cliente', 'TipoDocumento', 'Bodega', 
      'StockPorBodega', 'Pedido', 'DetallePedido', 'MetodoPago', 
      'Caja', 'TurnoCaja', 'ArqueoCaja', 'Venta', 'Pago', 'MovimientoStock'
    ];

    for (const modelName of requiredModels) {
      if (!models[modelName]) {
        throw new Error(`Modelo ${modelName} no encontrado en sequelize.models`);
      }
    }

    // === USUARIOS Y ROLES ===
    Usuario.belongsTo(Rol, { foreignKey: 'id_rol', as: 'rol' });
    Rol.hasMany(Usuario, { foreignKey: 'id_rol', as: 'usuarios' });

    // === PRODUCTOS Y CATEGORÍAS ===
    Producto.belongsTo(Categoria, { foreignKey: 'id_categoria', as: 'categoria' });
    Categoria.hasMany(Producto, { foreignKey: 'id_categoria', as: 'productos' });

    // === VARIANTES DE PRODUCTOS ===
    VarianteProducto.belongsTo(Producto, { foreignKey: 'id_producto', as: 'producto' });
    Producto.hasMany(VarianteProducto, { foreignKey: 'id_producto', as: 'variantes' });

    // ✅ CAMBIO CRÍTICO: MODALIDADES AHORA VAN A NIVEL DE VARIANTE
    ModalidadProducto.belongsTo(VarianteProducto, { foreignKey: 'id_variante_producto', as: 'varianteProducto' });
    VarianteProducto.hasMany(ModalidadProducto, { foreignKey: 'id_variante_producto', as: 'modalidades' });

    // === STOCK POR BODEGA (CON VARIANTES) ===
    StockPorBodega.belongsTo(VarianteProducto, { foreignKey: 'id_variante_producto', as: 'varianteProducto' });
    StockPorBodega.belongsTo(Bodega, { foreignKey: 'id_bodega', as: 'bodega' });
    VarianteProducto.hasMany(StockPorBodega, { foreignKey: 'id_variante_producto', as: 'stockPorBodega' });
    Bodega.hasMany(StockPorBodega, { foreignKey: 'id_bodega', as: 'stock' });

    // === CLIENTES Y PEDIDOS ===
    Cliente.hasMany(Pedido, { foreignKey: 'id_cliente', as: 'pedidos' });
    Pedido.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });

    // === USUARIOS VENDEDORES Y PEDIDOS ===
    Usuario.hasMany(Pedido, { foreignKey: 'id_vendedor', as: 'pedidosVendedor' });
    Pedido.belongsTo(Usuario, { foreignKey: 'id_vendedor', as: 'vendedor' });

    // === DETALLE PEDIDOS (ESTRUCTURA ACTUALIZADA) ===
    Pedido.hasMany(DetallePedido, { foreignKey: 'id_pedido', as: 'detalles', onDelete: 'CASCADE' });
    DetallePedido.belongsTo(Pedido, { foreignKey: 'id_pedido', as: 'pedido' });
    
    // ✅ DETALLE PEDIDOS → VARIANTE PRODUCTO
    VarianteProducto.hasMany(DetallePedido, { foreignKey: 'id_variante_producto', as: 'detallesPedidos' });
    DetallePedido.belongsTo(VarianteProducto, { foreignKey: 'id_variante_producto', as: 'varianteProducto' });
    
    // ✅ DETALLE PEDIDOS → MODALIDAD
    ModalidadProducto.hasMany(DetallePedido, { foreignKey: 'id_modalidad', as: 'detallesPedidos' });
    DetallePedido.belongsTo(ModalidadProducto, { foreignKey: 'id_modalidad', as: 'modalidad' });

    // === AUTORIZACIONES DE PRECIO ===
    Usuario.hasMany(DetallePedido, { foreignKey: 'precio_autorizado_por', as: 'autorizacionesPrecios' });
    DetallePedido.belongsTo(Usuario, { foreignKey: 'precio_autorizado_por', as: 'usuarioAutorizador' });

    // === CAJAS Y TURNOS ===
    Caja.hasMany(TurnoCaja, { foreignKey: 'id_caja', as: 'turnos' });
    TurnoCaja.belongsTo(Caja, { foreignKey: 'id_caja', as: 'caja' });
    
    Usuario.hasMany(TurnoCaja, { foreignKey: 'id_cajero', as: 'turnosCajero' });
    TurnoCaja.belongsTo(Usuario, { foreignKey: 'id_cajero', as: 'cajero' });

    // === ARQUEOS ===
    TurnoCaja.hasOne(ArqueoCaja, { foreignKey: 'id_turno', as: 'arqueo' });
    ArqueoCaja.belongsTo(TurnoCaja, { foreignKey: 'id_turno', as: 'turno' });

    // === VENTAS ===
    Pedido.hasOne(Venta, { foreignKey: 'id_pedido', as: 'venta' });
    Venta.belongsTo(Pedido, { foreignKey: 'id_pedido', as: 'pedido' });
    
    TurnoCaja.hasMany(Venta, { foreignKey: 'id_turno', as: 'ventas' });
    Venta.belongsTo(TurnoCaja, { foreignKey: 'id_turno', as: 'turno' });
    
    TipoDocumento.hasMany(Venta, { foreignKey: 'id_tipo_documento', as: 'ventas' });
    Venta.belongsTo(TipoDocumento, { foreignKey: 'id_tipo_documento', as: 'tipoDocumento' });
    
    Bodega.hasMany(Venta, { foreignKey: 'id_bodega', as: 'ventasBodega' });
    Venta.belongsTo(Bodega, { foreignKey: 'id_bodega', as: 'bodega' });

    // === PAGOS ===
    Venta.hasMany(Pago, { foreignKey: 'id_venta', as: 'pagos', onDelete: 'CASCADE' });
    Pago.belongsTo(Venta, { foreignKey: 'id_venta', as: 'venta' });
    
    MetodoPago.hasMany(Pago, { foreignKey: 'id_metodo_pago', as: 'pagos' });
    Pago.belongsTo(MetodoPago, { foreignKey: 'id_metodo_pago', as: 'metodoPago' });

    // ✅ MOVIMIENTOS DE STOCK
    VarianteProducto.hasMany(MovimientoStock, { foreignKey: 'id_variante_producto', as: 'movimientos' });
    MovimientoStock.belongsTo(VarianteProducto, { foreignKey: 'id_variante_producto', as: 'varianteProducto' });
    
    Bodega.hasMany(MovimientoStock, { foreignKey: 'id_bodega', as: 'movimientosOrigen' });
    MovimientoStock.belongsTo(Bodega, { foreignKey: 'id_bodega', as: 'bodega' });
    
    Bodega.hasMany(MovimientoStock, { foreignKey: 'id_bodega_destino', as: 'movimientosDestino' });
    MovimientoStock.belongsTo(Bodega, { foreignKey: 'id_bodega_destino', as: 'bodegaDestino' });
    
    Usuario.hasMany(MovimientoStock, { foreignKey: 'id_usuario', as: 'movimientosStock' });
    MovimientoStock.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

    console.log('✅ Asociaciones configuradas para nueva estructura BD');
  } catch (error) {
    console.error('❌ Error configurando asociaciones:', error);
    throw error;
  }
}