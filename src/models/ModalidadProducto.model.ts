// src/models/ModalidadProducto.model.ts - VERSIÓN CORREGIDA
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo, 
  ForeignKey,
  Index
} from 'sequelize-typescript';
import { Producto } from './Producto.model';

@Table({
  tableName: 'modalidades_producto',
  timestamps: false,
  indexes: [
    { fields: ['activa'] },
    { fields: ['precio_neto'] },
    { fields: ['id_producto', 'nombre'], unique: true }
  ]
})
export class ModalidadProducto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_modalidad!: number;

  // ✅ CORRECCIÓN: Las modalidades van a nivel de PRODUCTO, no variante
  @ForeignKey(() => Producto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_producto!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false
  })
  nombre!: string; // "Por metro", "Rollo", "Embalaje"

  @Column({
    type: DataType.STRING(100),
    allowNull: true
  })
  descripcion?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  cantidad_base!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  es_cantidad_variable!: boolean;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  minimo_cantidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    defaultValue: 0
  })
  precio_costo!: number;

  @Index
  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_neto!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_neto_factura!: number;

  // Calculado en runtime
  get precio_con_iva(): number {
    return Math.round(Number(this.precio_neto_factura) * 1.19);
  }

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  activa!: boolean;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_creacion!: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_actualizacion!: Date;

  // ✅ RELACIÓN CORREGIDA: Con Producto
  @BelongsTo(() => Producto, 'id_producto')
  producto!: Producto;

  // ✅ MÉTODOS CORREGIDOS
  obtenerPrecioPorTipoDocumento(tipoDocumento: 'ticket' | 'boleta' | 'factura'): number {
    switch (tipoDocumento) {
      case 'ticket':
      case 'boleta':
        return Number(this.precio_neto);
      case 'factura':
        return this.precio_con_iva;
      default:
        return Number(this.precio_neto);
    }
  }

  validarCantidad(cantidad: number): { valida: boolean; mensaje?: string } {
    if (cantidad <= 0) {
      return { valida: false, mensaje: 'La cantidad debe ser mayor a 0' };
    }
    if (this.minimo_cantidad > 0 && cantidad < this.minimo_cantidad) {
      return { 
        valida: false, 
        mensaje: `Cantidad mínima requerida: ${this.minimo_cantidad}` 
      };
    }
    return { valida: true };
  }

  calcularSubtotal(cantidad: number, tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): number {
    const precio = this.obtenerPrecioPorTipoDocumento(tipoDocumento);
    return Math.round(Number(cantidad) * precio);
  }
}