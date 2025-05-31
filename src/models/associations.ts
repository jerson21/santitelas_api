// src/models/associations.ts - VERSIÓN CORREGIDA
import { Categoria } from './Categoria.model';
import { Producto } from './Producto.model';
import { VarianteProducto } from './VarianteProducto.model';
import { ModalidadProducto } from './ModalidadProducto.model';
import { DetallePedido } from './DetallePedido.model';
import { Pedido } from './Pedido.model';
import { StockPorBodega } from './StockPorBodega.model';
import { MovimientoStock } from './MovimientoStock.model';
import { Usuario } from './Usuario.model';
import { Bodega } from './Bodega.model';
import { Cliente } from './Cliente.model';
import { TurnoCaja } from './TurnoCaja.model';
import { Caja } from './Caja.model';
import { ArqueoCaja } from './ArqueoCaja.model';
import { Venta } from './Venta.model';
import { Pago } from './Pago.model';
import { MetodoPago } from './MetodoPago.model';
import { TipoDocumento } from './TipoDocumento.model';
import { Rol } from './Rol.model';

export function setupAssociations() {
  try {
    console.log('🔗 Configurando asociaciones corregidas...');

    // ===============================
    // USUARIOS Y ROLES
    // ===============================
    Usuario.belongsTo(Rol, { 
      foreignKey: 'id_rol', 
      as: 'rol' 
    });
    Rol.hasMany(Usuario, { 
      foreignKey: 'id_rol', 
      as: 'usuarios' 
    });

    // ===============================
    // PRODUCTOS Y CATEGORÍAS
    // ===============================
    Producto.belongsTo(Categoria, { 
      foreignKey: 'id_categoria', 
      as: 'categoria' 
    });
    Categoria.hasMany(Producto, { 
      foreignKey: 'id_categoria', 
      as: 'productos' 
    });

    // ===============================
    // PRODUCTO → VARIANTES
    // ===============================
    Producto.hasMany(VarianteProducto, { 
      foreignKey: 'id_producto', 
      as: 'variantes' 
    });
    VarianteProducto.belongsTo(Producto, { 
      foreignKey: 'id_producto', 
      as: 'producto' 
    });

    // ===============================
    // VARIANTE → MODALIDADES (CLAVE)
    // ===============================
    VarianteProducto.hasMany(ModalidadProducto, { 
      foreignKey: 'id_variante_producto', 
      as: 'modalidades' 
    });
    ModalidadProducto.belongsTo(VarianteProducto, { 
      foreignKey: 'id_variante_producto', 
      as: 'varianteProducto' 
    });

    // ===============================
    // STOCK POR BODEGA
    // ===============================
    VarianteProducto.hasMany(StockPorBodega, { 
      foreignKey: 'id_variante_producto', 
      as: 'stockPorBodega' 
    });
    StockPorBodega.belongsTo(VarianteProducto, { 
      foreignKey: 'id_variante_producto', 
      as: 'varianteProducto' 
    });
    
    Bodega.hasMany(StockPorBodega, { 
      foreignKey: 'id_bodega', 
      as: 'stocks' 
    });
    StockPorBodega.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });

    // ===============================
    // MOVIMIENTOS DE STOCK
    // ===============================
    VarianteProducto.hasMany(MovimientoStock, { 
      foreignKey: 'id_variante_producto', 
      as: 'movimientos' 
    });
    MovimientoStock.belongsTo(VarianteProducto, { 
      foreignKey: 'id_variante_producto', 
      as: 'varianteProducto' 
    });
    
    Bodega.hasMany(MovimientoStock, { 
      foreignKey: 'id_bodega', 
      as: 'movimientosOrigen' 
    });
    MovimientoStock.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });
    
    MovimientoStock.belongsTo(Bodega, { 
      foreignKey: 'id_bodega_destino', 
      as: 'bodegaDestino' 
    });
    
    Usuario.hasMany(MovimientoStock, { 
      foreignKey: 'id_usuario', 
      as: 'movimientosStock' 
    });
    MovimientoStock.belongsTo(Usuario, { 
      foreignKey: 'id_usuario', 
      as: 'usuario' 
    });

    // ===============================
    // CLIENTES Y PEDIDOS
    // ===============================
    Cliente.hasMany(Pedido, { 
      foreignKey: 'id_cliente', 
      as: 'pedidos' 
    });
    Pedido.belongsTo(Cliente, { 
      foreignKey: 'id_cliente', 
      as: 'cliente' 
    });

    // ===============================
    // VENDEDORES Y PEDIDOS
    // ===============================
    Usuario.hasMany(Pedido, { 
      foreignKey: 'id_vendedor', 
      as: 'pedidosVendedor' 
    });
    Pedido.belongsTo(Usuario, { 
      foreignKey: 'id_vendedor', 
      as: 'vendedor' 
    });

    // ===============================
    // DETALLE PEDIDOS (ESTRUCTURA CORRECTA)
    // ===============================
    Pedido.hasMany(DetallePedido, { 
      foreignKey: 'id_pedido', 
      as: 'detalles', 
      onDelete: 'CASCADE' 
    });
    DetallePedido.belongsTo(Pedido, { 
      foreignKey: 'id_pedido', 
      as: 'pedido' 
    });
    
    // DETALLE → VARIANTE
    VarianteProducto.hasMany(DetallePedido, { 
      foreignKey: 'id_variante_producto', 
      as: 'detallesPedidos' 
    });
    DetallePedido.belongsTo(VarianteProducto, { 
      foreignKey: 'id_variante_producto', 
      as: 'varianteProducto' 
    });
    
    // DETALLE → MODALIDAD
    ModalidadProducto.hasMany(DetallePedido, { 
      foreignKey: 'id_modalidad', 
      as: 'detallesPedidos' 
    });
    DetallePedido.belongsTo(ModalidadProducto, { 
      foreignKey: 'id_modalidad', 
      as: 'modalidad' 
    });

    // ===============================
    // AUTORIZACIONES DE PRECIO
    // ===============================
    Usuario.hasMany(DetallePedido, { 
      foreignKey: 'precio_autorizado_por', 
      as: 'autorizacionesPrecios' 
    });
    DetallePedido.belongsTo(Usuario, { 
      foreignKey: 'precio_autorizado_por', 
      as: 'usuarioAutorizador' 
    });

    // ===============================
    // CAJAS Y TURNOS
    // ===============================
    Caja.hasMany(TurnoCaja, { 
      foreignKey: 'id_caja', 
      as: 'turnos' 
    });
    TurnoCaja.belongsTo(Caja, { 
      foreignKey: 'id_caja', 
      as: 'caja' 
    });
    
    Usuario.hasMany(TurnoCaja, { 
      foreignKey: 'id_cajero', 
      as: 'turnosCajero' 
    });
    TurnoCaja.belongsTo(Usuario, { 
      foreignKey: 'id_cajero', 
      as: 'cajero' 
    });

    // ===============================
    // ARQUEOS
    // ===============================
    TurnoCaja.hasOne(ArqueoCaja, { 
      foreignKey: 'id_turno', 
      as: 'arqueo' 
    });
    ArqueoCaja.belongsTo(TurnoCaja, { 
      foreignKey: 'id_turno', 
      as: 'turno' 
    });

    // ===============================
    // VENTAS
    // ===============================
    Pedido.hasOne(Venta, { 
      foreignKey: 'id_pedido', 
      as: 'venta' 
    });
    Venta.belongsTo(Pedido, { 
      foreignKey: 'id_pedido', 
      as: 'pedido' 
    });
    
    TurnoCaja.hasMany(Venta, { 
      foreignKey: 'id_turno', 
      as: 'ventas' 
    });
    Venta.belongsTo(TurnoCaja, { 
      foreignKey: 'id_turno', 
      as: 'turno' 
    });
    
    TipoDocumento.hasMany(Venta, { 
      foreignKey: 'id_tipo_documento', 
      as: 'ventas' 
    });
    Venta.belongsTo(TipoDocumento, { 
      foreignKey: 'id_tipo_documento', 
      as: 'tipoDocumento' 
    });
    
    Bodega.hasMany(Venta, { 
      foreignKey: 'id_bodega', 
      as: 'ventasBodega' 
    });
    Venta.belongsTo(Bodega, { 
      foreignKey: 'id_bodega', 
      as: 'bodega' 
    });

    // ===============================
    // PAGOS
    // ===============================
    Venta.hasMany(Pago, { 
      foreignKey: 'id_venta', 
      as: 'pagos', 
      onDelete: 'CASCADE' 
    });
    Pago.belongsTo(Venta, { 
      foreignKey: 'id_venta', 
      as: 'venta' 
    });
    
    MetodoPago.hasMany(Pago, { 
      foreignKey: 'id_metodo_pago', 
      as: 'pagos' 
    });
    Pago.belongsTo(MetodoPago, { 
      foreignKey: 'id_metodo_pago', 
      as: 'metodoPago' 
    });

    console.log('✅ Asociaciones configuradas correctamente');
  } catch (error) {
    console.error('❌ Error configurando asociaciones:', error);
    throw error;
  }
}

// ===============================
// INCLUDES HELPER FUNCTIONS
// ===============================

export const getProductoCompleteInclude = () => [
  {
    model: Categoria,
    as: 'categoria'
  },
  {
    model: VarianteProducto,
    as: 'variantes',
    where: { activo: true },
    required: false,
    include: [
      {
        model: ModalidadProducto,
        as: 'modalidades',
        where: { activa: true },
        required: false
      },
      {
        model: StockPorBodega,
        as: 'stockPorBodega',
        required: false,
        include: [
          {
            model: Bodega,
            as: 'bodega'
          }
        ]
      }
    ]
  }
];

export const getDetallePedidoCompleteInclude = () => [
  {
    model: VarianteProducto,
    as: 'varianteProducto',
    include: [
      {
        model: Producto,
        as: 'producto',
        include: [
          {
            model: Categoria,
            as: 'categoria'
          }
        ]
      },
      {
        model: ModalidadProducto,
        as: 'modalidades',
        where: { activa: true },
        required: false
      }
    ]
  },
  {
    model: ModalidadProducto,
    as: 'modalidad'
  },
  {
    model: Usuario,
    as: 'usuarioAutorizador',
    required: false
  }
];

export const getPedidoCompleteInclude = () => [
  {
    model: DetallePedido,
    as: 'detalles',
    include: getDetallePedidoCompleteInclude()
  },
  {
    model: Usuario,
    as: 'vendedor'
  },
  {
    model: Cliente,
    as: 'cliente',
    required: false
  }
];