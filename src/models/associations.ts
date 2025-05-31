// src/models/associations.ts - ASOCIACIONES PARA NUEVA ESTRUCTURA BD
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

export function setupAssociations() {
  // ✅ ASOCIACIONES DE CATEGORÍA Y PRODUCTO
  Categoria.hasMany(Producto, {
    foreignKey: 'id_categoria',
    as: 'productos'
  });

  Producto.belongsTo(Categoria, {
    foreignKey: 'id_categoria',
    as: 'categoria'
  });

  // ✅ ASOCIACIONES DE PRODUCTO Y VARIANTES
  Producto.hasMany(VarianteProducto, {
    foreignKey: 'id_producto',
    as: 'variantes'
  });

  VarianteProducto.belongsTo(Producto, {
    foreignKey: 'id_producto',
    as: 'producto'
  });

  // ✅ NUEVA ESTRUCTURA: VARIANTE → MODALIDADES
  VarianteProducto.hasMany(ModalidadProducto, {
    foreignKey: 'id_variante_producto',
    as: 'modalidades'
  });

  ModalidadProducto.belongsTo(VarianteProducto, {
    foreignKey: 'id_variante_producto',
    as: 'varianteProducto'
  });

  // ✅ ASOCIACIONES DE STOCK
  VarianteProducto.hasMany(StockPorBodega, {
    foreignKey: 'id_variante_producto',
    as: 'stockPorBodega'
  });

  StockPorBodega.belongsTo(VarianteProducto, {
    foreignKey: 'id_variante_producto',
    as: 'varianteProducto'
  });

  StockPorBodega.belongsTo(Bodega, {
    foreignKey: 'id_bodega',
    as: 'bodega'
  });

  Bodega.hasMany(StockPorBodega, {
    foreignKey: 'id_bodega',
    as: 'stocks'
  });

  // ✅ ASOCIACIONES DE MOVIMIENTOS
  VarianteProducto.hasMany(MovimientoStock, {
    foreignKey: 'id_variante_producto',
    as: 'movimientos'
  });

  MovimientoStock.belongsTo(VarianteProducto, {
    foreignKey: 'id_variante_producto',
    as: 'varianteProducto'
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

  // ✅ ASOCIACIONES DE PEDIDOS
  Pedido.hasMany(DetallePedido, {
    foreignKey: 'id_pedido',
    as: 'detalles'
  });

  DetallePedido.belongsTo(Pedido, {
    foreignKey: 'id_pedido',
    as: 'pedido'
  });

  // ✅ NUEVA ESTRUCTURA: DETALLE → VARIANTE Y MODALIDAD
  DetallePedido.belongsTo(VarianteProducto, {
    foreignKey: 'id_variante_producto',
    as: 'varianteProducto'
  });

  VarianteProducto.hasMany(DetallePedido, {
    foreignKey: 'id_variante_producto',
    as: 'detallesPedidos'
  });

  DetallePedido.belongsTo(ModalidadProducto, {
    foreignKey: 'id_modalidad',
    as: 'modalidad'
  });

  ModalidadProducto.hasMany(DetallePedido, {
    foreignKey: 'id_modalidad',
    as: 'detallesPedidos'
  });

  // ✅ ASOCIACIONES DE USUARIOS
  DetallePedido.belongsTo(Usuario, {
    foreignKey: 'precio_autorizado_por',
    as: 'usuarioAutorizador'
  });

  Usuario.hasMany(DetallePedido, {
    foreignKey: 'precio_autorizado_por',
    as: 'preciosAutorizados'
  });

  Pedido.belongsTo(Usuario, {
    foreignKey: 'id_vendedor',
    as: 'vendedor'
  });

  Usuario.hasMany(Pedido, {
    foreignKey: 'id_vendedor',
    as: 'pedidos'
  });

  Usuario.hasMany(MovimientoStock, {
    foreignKey: 'id_usuario',
    as: 'movimientosStock'
  });
}

// ✅ FUNCIÓN PARA OBTENER INCLUDES COMUNES
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
  }
];