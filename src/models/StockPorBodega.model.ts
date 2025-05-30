// src/models/StockPorBodega.model.ts - VERSIÓN CORRECTA
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
import { VarianteProducto } from './VarianteProducto.model';
import { Bodega } from './Bodega.model';

@Table({
  tableName: 'stock_por_bodega',
  timestamps: false,
  indexes: [
    { fields: ['id_variante_producto', 'id_bodega'], unique: true }
  ]
})
export class StockPorBodega extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_stock!: number;

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
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  cantidad_disponible!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  cantidad_reservada!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  stock_minimo!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  stock_maximo!: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_actualizacion!: Date;

  // RELACIONES
  @BelongsTo(() => VarianteProducto, 'id_variante_producto')
  varianteProducto!: VarianteProducto;

  @BelongsTo(() => Bodega, 'id_bodega')
  bodega!: Bodega;

  // MÉTODOS
  tieneDisponibilidad(cantidad: number): boolean {
    return this.cantidad_disponible >= cantidad;
  }

  estaPorDebajoDelMinimo(): boolean {
    return this.cantidad_disponible < this.stock_minimo;
  }

  cantidadTotal(): number {
    return this.cantidad_disponible + this.cantidad_reservada;
  }

  getEstadoStock(): 'sin_stock' | 'bajo_minimo' | 'normal' | 'sobre_maximo' {
    if (this.cantidad_disponible === 0) return 'sin_stock';
    if (this.cantidad_disponible < this.stock_minimo) return 'bajo_minimo';
    if (this.stock_maximo > 0 && this.cantidad_disponible > this.stock_maximo) return 'sobre_maximo';
    return 'normal';
  }

  getPorcentajeStock(): number {
    if (this.stock_minimo === 0) return 100;
    return Math.round((this.cantidad_disponible / this.stock_minimo) * 100);
  }
}
