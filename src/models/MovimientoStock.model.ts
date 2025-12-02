// src/models/MovimientoStock.model.ts - VERSIÃ“N CORREGIDA
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey
} from 'sequelize-typescript';
import { VarianteProducto } from './VarianteProducto.model';  // âœ… CORREGIDO
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

  // âœ… CORREGIDO: Usar id_variante_producto como en el SQL
  @ForeignKey(() => VarianteProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_variante_producto!: number;

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
  id_bodega_destino?: number;

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

  // ✅ RELACIONES (definidas en index.ts setupAssociations)
  varianteProducto!: VarianteProducto;

  bodega!: Bodega;

  bodegaDestino?: Bodega;

  usuario!: Usuario;
}
