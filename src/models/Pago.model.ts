// src/models/Pago.model.ts
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
import { Venta } from './Venta.model';
import { MetodoPago } from './MetodoPago.model';

@Table({
  tableName: 'pagos',
  timestamps: false
})
export class Pago extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_pago!: number;

  @ForeignKey(() => Venta)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_venta!: number;

  @ForeignKey(() => MetodoPago)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_metodo_pago!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  monto!: number;

  @Column({
    type: DataType.STRING(100)
  })
  referencia?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_pago!: Date;

  @BelongsTo(() => Venta, 'id_venta')
  venta!: Venta;

  @BelongsTo(() => MetodoPago, 'id_metodo_pago')
  metodoPago!: MetodoPago;
}