// src/models/MovimientoStock.model.ts
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
import { Producto } from './Producto.model';
import { Bodega } from './Bodega.model';
import { Usuario } from './Usuario.model';

@Table({
  tableName: 'movimientos_stock',
  timestamps: false
})
export class MovimientoStock extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_movimiento!: number;

  @ForeignKey(() => Producto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_producto!: number;

  @ForeignKey(() => Bodega)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_bodega!: number;

  @Column({
    type: DataType.ENUM('entrada', 'salida', 'ajuste', 'transferencia'),
    allowNull: false
  })
  tipo_movimiento!: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  cantidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  stock_anterior!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  stock_nuevo!: number;

  @ForeignKey(() => Bodega)
  @Column({
    type: DataType.INTEGER
  })
  id_bodega_destino?: number; // Para transferencias

  @Column({
    type: DataType.STRING(100),
    allowNull: false
  })
  motivo!: string;

  @Column({
    type: DataType.STRING(50)
  })
  referencia?: string;

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_usuario!: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_movimiento!: Date;

  @BelongsTo(() => Producto, 'id_producto')
  producto!: Producto;

  @BelongsTo(() => Bodega, 'id_bodega')
  bodega!: Bodega;

  @BelongsTo(() => Bodega, 'id_bodega_destino')
  bodegaDestino?: Bodega;

  @BelongsTo(() => Usuario, 'id_usuario')
  usuario!: Usuario;
}