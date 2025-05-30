// src/models/Venta.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo,
  ForeignKey,
  HasMany
} from 'sequelize-typescript';
import { Pedido } from './Pedido.model';
import { TurnoCaja } from './TurnoCaja.model';
import { TipoDocumento } from './TipoDocumento.model';
import { Bodega } from './Bodega.model';
import { Pago } from './Pago.model';

@Table({
  tableName: 'ventas',
  timestamps: false
})
export class Venta extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_venta!: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true
  })
  numero_venta!: string;

  @ForeignKey(() => Pedido)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true
  })
  id_pedido!: number;

  @ForeignKey(() => TurnoCaja)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_turno!: number;

  @ForeignKey(() => TipoDocumento)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_tipo_documento!: number;

  @ForeignKey(() => Bodega)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_bodega!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  subtotal!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  descuento!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  iva!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  total!: number;

  @Column({
    type: DataType.STRING(100)
  })
  nombre_cliente?: string;

  @Column({
    type: DataType.STRING(20)
  })
  rut_cliente?: string;

  @Column(DataType.TEXT)
  direccion_cliente?: string;

  @Column({
    type: DataType.STRING(20)
  })
  telefono_cliente?: string;

  @Column({
    type: DataType.ENUM('completada', 'anulada'),
    defaultValue: 'completada'
  })
  estado!: string;

  @Column(DataType.TEXT)
  observaciones?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_venta!: Date;

  @BelongsTo(() => Pedido, 'id_pedido')
  pedido!: Pedido;

  @BelongsTo(() => TurnoCaja, 'id_turno')
  turno!: TurnoCaja;

  @BelongsTo(() => TipoDocumento, 'id_tipo_documento')
  tipoDocumento!: TipoDocumento;

  @BelongsTo(() => Bodega, 'id_bodega')
  bodega!: Bodega;

  @HasMany(() => Pago, 'id_venta')
  pagos!: Pago[];

  calcularTotal() {
    this.total = this.subtotal - this.descuento + this.iva;
  }

  calcularIva() {
    if (this.tipoDocumento?.aplica_iva) {
      this.iva = (this.subtotal - this.descuento) * 0.19;
    } else {
      this.iva = 0;
    }
  }
}
