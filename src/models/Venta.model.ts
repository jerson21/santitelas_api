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
    type: DataType.STRING(100)
  })
  email_cliente?: string;

  @Column({
    type: DataType.STRING(100)
  })
  razon_social?: string;

  @Column({
    type: DataType.STRING(100)
  })
  comuna?: string;

  @Column({
    type: DataType.STRING(200)
  })
  giro?: string;

  // Campos DTE (Documento Tributario Electrónico) - Relbase
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'folio_dte'
  })
  folio_dte?: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'tipo_dte'
  })
  tipo_dte?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'timbre_ted'
  })
  timbre_ted?: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'pdf_url_dte'
  })
  pdf_url_dte?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'modo_prueba_dte'
  })
  modo_prueba_dte?: boolean;

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

  pedido!: Pedido;

  turno!: TurnoCaja;

  tipoDocumento!: TipoDocumento;

  bodega!: Bodega;

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
