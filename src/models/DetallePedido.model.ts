
// src/models/DetallePedido.model.ts - ACTUALIZACIÃ“N COMPLETA
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo, 
  ForeignKey 
} from 'sequelize-typescript';
import { Pedido } from './Pedido.model';
import { VarianteProducto } from './VarianteProducto.model';
import { ModalidadProducto } from './ModalidadProducto.model';
import { Usuario } from './Usuario.model';

@Table({
  tableName: 'detalle_pedidos',
  timestamps: false
})
export class DetallePedido extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_detalle!: number;

  @ForeignKey(() => Pedido)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_pedido!: number;

  @ForeignKey(() => VarianteProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_variante_producto!: number;

  @ForeignKey(() => ModalidadProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_modalidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  cantidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_unitario!: number;

  @Column({
    type: DataType.ENUM('neto', 'factura', 'personalizado'),
    defaultValue: 'neto'
  })
  tipo_precio!: 'neto' | 'factura' | 'personalizado';

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  precio_autorizado_por?: number;

  @Column({
    type: DataType.STRING(200),
    allowNull: true
  })
  motivo_precio_personalizado?: string;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  subtotal!: number;

  @Column(DataType.TEXT)
  observaciones?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_creacion!: Date;

  // RELACIONES ACTUALIZADAS
  pedido!: Pedido;

  varianteProducto!: VarianteProducto;

  modalidad!: ModalidadProducto;

  usuarioAutorizador?: Usuario;

  // MÃ‰TODOS ACTUALIZADOS
  calcularSubtotal(): number {
    return Math.round(this.cantidad * this.precio_unitario);
  }

  obtenerPrecioFinal(tipoDocumento: 'ticket' | 'boleta' | 'factura'): number {
    if (this.tipo_precio === 'personalizado') {
      return this.precio_unitario;
    }
    
    if (this.modalidad) {
      return this.modalidad.obtenerPrecioPorTipoDocumento(tipoDocumento);
    }
    
    return this.precio_unitario;
  }

  getDescripcionCompleta(): string {
    if (!this.varianteProducto || !this.modalidad) return 'Producto no encontrado';
    
    const producto = this.varianteProducto.producto;
    if (!producto) return 'Producto no encontrado';
    
    return `${producto.getDescripcionCompleta()} - ${this.varianteProducto.getDescripcionCompleta()} - ${this.modalidad.nombre}`;
  }

  validarStock(): { valido: boolean; mensaje?: string } {
    if (!this.varianteProducto) {
      return { valido: false, mensaje: 'Variante de producto no encontrada' };
    }

    const stockDisponible = this.varianteProducto.calcularStockTotal();
    
    if (stockDisponible < this.cantidad) {
      return { 
        valido: false, 
        mensaje: `Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${this.cantidad}` 
      };
    }

    return { valido: true };
  }
}
