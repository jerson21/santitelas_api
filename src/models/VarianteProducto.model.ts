// src/models/VarianteProducto.model.ts - VERSIÃ“N CORREGIDA
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
import { Producto } from './Producto.model';
import { StockPorBodega } from './StockPorBodega.model';
import { MovimientoStock } from './MovimientoStock.model';

@Table({
  tableName: 'variantes_producto',
  timestamps: false,
  indexes: [
    { fields: ['sku'], unique: true },
    { fields: ['activo'] },
    { fields: ['color'] },
    { fields: ['medida'] }
  ]
})
export class VarianteProducto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_variante_producto!: number;

  @ForeignKey(() => Producto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_producto!: number;

  @Column({
    type: DataType.STRING(50),
    unique: true,
    allowNull: false
  })
  sku!: string;

  @Column({
    type: DataType.STRING(30),
    allowNull: true
  })
  color?: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true
  })
  medida?: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true
  })
  material?: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({ 
    type: DataType.DECIMAL(10, 2), 
    defaultValue: 0 
  })
  stock_minimo!: number;

  @Column({ 
    type: DataType.BOOLEAN, 
    defaultValue: true 
  })
  activo!: boolean;

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

  // âœ… RELACIONES CORREGIDAS
  producto!: Producto;

  // âœ… ELIMINAR MODALIDADES - Van a nivel de producto
  // Las modalidades NO van aquÃ­, van en Producto

  stockPorBodega!: StockPorBodega[];

  movimientos!: MovimientoStock[];

  // âœ… MÃ‰TODOS CORREGIDOS
  calcularStockTotal(): number {
    return this.stockPorBodega?.reduce((total, stock) => total + stock.cantidad_disponible, 0) || 0;
  }

  getDescripcionCompleta(): string {
    const partes: string[] = [];
    
    if (this.color) partes.push(this.color);
    if (this.medida) partes.push(`Med. ${this.medida}`);
    if (this.material) partes.push(this.material);
    
    return partes.length > 0 ? partes.join(' - ') : 'EstÃ¡ndar';
  }

  tieneStock(cantidad: number = 1): boolean {
    return this.calcularStockTotal() >= cantidad;
  }

  obtenerStockEnBodega(idBodega: number): number {
    const stock = this.stockPorBodega?.find(s => s.id_bodega === idBodega);
    return stock?.cantidad_disponible || 0;
  }

  coincideConFiltros(filtros: {
    color?: string;
    medida?: string;
    material?: string;
  }): boolean {
    if (filtros.color && this.color !== filtros.color) return false;
    if (filtros.medida && this.medida !== filtros.medida) return false;
    if (filtros.material && this.material !== filtros.material) return false;
    
    return true;
  }
}
