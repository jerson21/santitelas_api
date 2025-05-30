// ===========================
// src/models/Bodega.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { StockPorBodega } from './StockPorBodega.model';
import { Venta } from './Venta.model';
import { MovimientoStock } from './MovimientoStock.model';

@Table({
  tableName: 'bodegas',
  timestamps: false
})
export class Bodega extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_bodega!: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true
  })
  codigo!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false
  })
  nombre!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({
    type: DataType.STRING(200)
  })
  direccion?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  es_punto_venta!: boolean;

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

  stock!: StockPorBodega[];

  ventas!: Venta[];

  movimientos!: MovimientoStock[];
}
