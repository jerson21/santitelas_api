// src/models/index.ts
import { sequelize } from '../config/database';

// Importar modelos completos
import { Rol } from './Rol.model';
import { Usuario } from './Usuario.model';
import { Categoria } from './Categoria.model';
import { Producto } from './Producto.model';
import { ModalidadProducto } from './ModalidadProducto.model';  // NUEVO
import { Cliente } from './Cliente.model';                      // NUEVO
import { TipoDocumento } from './TipoDocumento.model';
import { Bodega } from './Bodega.model';
import { StockPorBodega } from './StockPorBodega.model';
import { Pedido } from './Pedido.model';
import { DetallePedido } from './DetallePedido.model';
import { MetodoPago } from './MetodoPago.model';
import { Caja } from './Caja.model';
import { VarianteProducto } from './VarianteProducto.model';


import { TurnoCaja } from './TurnoCaja.model';
import { ArqueoCaja } from './ArqueoCaja.model';

import { Venta } from './Venta.model';
import { Pago } from './Pago.model';
import { MovimientoStock } from './MovimientoStock.model';

// Exportar modelos
export {
  Rol,
  Usuario,
  Categoria,
  Producto,
  VarianteProducto,
  ModalidadProducto,  // NUEVO
  Cliente,            // NUEVO
  TipoDocumento,
  Bodega,
  StockPorBodega,
  Pedido,
  DetallePedido,
  MetodoPago,
  Caja,
  TurnoCaja,
  ArqueoCaja,
  Venta,
  Pago,
  MovimientoStock
};

// Función para inicializar modelos
export async function initializeModels() {
  try {
    // Agregar modelos a Sequelize
    sequelize.addModels([
      Rol,
      Usuario,
      Categoria,
      Producto,
      VarianteProducto,
      ModalidadProducto,
      Cliente,
      TipoDocumento,
      Bodega,
      StockPorBodega,
      Pedido,
      DetallePedido,
      MetodoPago,
      Caja,
      TurnoCaja,
      ArqueoCaja,
      Venta,
      Pago,
      MovimientoStock
    ]);

    console.log('📊 Modelos registrados:', Object.keys(sequelize.models).join(', '));
    return true;
  } catch (error) {
    console.error('❌ Error inicializando modelos:', error);
    throw error;
  }
}

// Función para establecer asociaciones completas
export function setupAssociations() {
  try {
    // === USUARIOS Y ROLES ===
    Usuario.belongsTo(Rol, { 
      foreignKey: 'id_rol', 
      as: 'rol' 
    });
    Rol.hasMany(Usuario, { 
      foreignKey: 'id_rol', 
      as: 'usuarios' 
    });

    // === PRODUCTOS Y CATEGORÍAS ===
    Producto.belongsTo(Categoria, { 
      foreignKey: 'id_categoria', 
      as: 'categoria' 
    });
    Categoria.hasMany(Producto, { 
      foreignKey: 'id_categoria', 
      as: 'productos' 
    });

    // === STOCK POR BODEGA ===
    StockPorBodega.belongsTo(Producto, { 
      foreignKey: 'id_producto', 
      as: 'producto' 
    });
    StockPorBodega.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });
    Producto.hasMany(StockPorBodega, { 
      foreignKey: 'id_producto', 
      as: 'stockPorBodega' 
    });
    Bodega.hasMany(StockPorBodega, { 
      foreignKey: 'id_bodega', 
      as: 'stock' 
    });

    // === PEDIDOS ===
    Pedido.belongsTo(Usuario, { 
      foreignKey: 'id_vendedor', 
      as: 'vendedor' 
    });
    Usuario.hasMany(Pedido, { 
      foreignKey: 'id_vendedor', 
      as: 'pedidos' 
    });

    // === DETALLE PEDIDOS ===
    DetallePedido.belongsTo(Pedido, { 
      foreignKey: 'id_pedido', 
      as: 'pedido' 
    });
    DetallePedido.belongsTo(Producto, { 
      foreignKey: 'id_producto', 
      as: 'producto' 
    });
    Pedido.hasMany(DetallePedido, { 
      foreignKey: 'id_pedido', 
      as: 'detalles',
      onDelete: 'CASCADE' 
    });
    Producto.hasMany(DetallePedido, { 
      foreignKey: 'id_producto', 
      as: 'detallesPedidos' 
    });

    // === CAJAS Y TURNOS ===
    Caja.hasMany(TurnoCaja, { 
      foreignKey: 'id_caja', 
      as: 'turnos' 
    });
    TurnoCaja.belongsTo(Caja, { 
      foreignKey: 'id_caja', 
      as: 'caja' 
    });

    TurnoCaja.belongsTo(Usuario, { 
      foreignKey: 'id_cajero', 
      as: 'cajero' 
    });
    Usuario.hasMany(TurnoCaja, { 
      foreignKey: 'id_cajero', 
      as: 'turnos' 
    });

    // === ARQUEOS ===
    ArqueoCaja.belongsTo(TurnoCaja, { 
      foreignKey: 'id_turno', 
      as: 'turno' 
    });
    TurnoCaja.hasOne(ArqueoCaja, { 
      foreignKey: 'id_turno', 
      as: 'arqueo' 
    });

    // === VENTAS ===
    Venta.belongsTo(Pedido, { 
      foreignKey: 'id_pedido', 
      as: 'pedido' 
    });
    Venta.belongsTo(TurnoCaja, { 
      foreignKey: 'id_turno', 
      as: 'turno' 
    });
    Venta.belongsTo(TipoDocumento, { 
      foreignKey: 'id_tipo_documento', 
      as: 'tipoDocumento' 
    });
    Venta.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });
    
    Pedido.hasOne(Venta, { 
      foreignKey: 'id_pedido', 
      as: 'venta' 
    });
    TurnoCaja.hasMany(Venta, { 
      foreignKey: 'id_turno', 
      as: 'ventas' 
    });
    TipoDocumento.hasMany(Venta, { 
      foreignKey: 'id_tipo_documento', 
      as: 'ventas' 
    });
    Bodega.hasMany(Venta, { 
      foreignKey: 'id_bodega', 
      as: 'ventas' 
    });

    // === PAGOS ===
    Pago.belongsTo(Venta, { 
      foreignKey: 'id_venta', 
      as: 'venta' 
    });
    Pago.belongsTo(MetodoPago, { 
      foreignKey: 'id_metodo_pago', 
      as: 'metodoPago' 
    });
    Venta.hasMany(Pago, { 
      foreignKey: 'id_venta', 
      as: 'pagos',
      onDelete: 'CASCADE' 
    });
    MetodoPago.hasMany(Pago, { 
      foreignKey: 'id_metodo_pago', 
      as: 'pagos' 
    });

    // === MOVIMIENTOS DE STOCK ===
    MovimientoStock.belongsTo(Producto, { 
      foreignKey: 'id_producto', 
      as: 'producto' 
    });
    MovimientoStock.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });
    MovimientoStock.belongsTo(Bodega, { 
      foreignKey: 'id_bodega_destino', 
      as: 'bodegaDestino' 
    });
    MovimientoStock.belongsTo(Usuario, { 
      foreignKey: 'id_usuario', 
      as: 'usuario' 
    });
    
    Producto.hasMany(MovimientoStock, { 
      foreignKey: 'id_producto', 
      as: 'movimientos' 
    });
    Bodega.hasMany(MovimientoStock, { 
      foreignKey: 'id_bodega', 
      as: 'movimientos' 
    });
    Usuario.hasMany(MovimientoStock, { 
      foreignKey: 'id_usuario', 
      as: 'movimientosStock' 
    });

    console.log('🔗 Asociaciones establecidas correctamente');
  } catch (error) {
    console.error('❌ Error configurando asociaciones:', error);
    throw error;
  }
}