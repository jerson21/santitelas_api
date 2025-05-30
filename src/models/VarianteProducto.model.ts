// src/models/VarianteProducto.model.ts - VERSIÓN LIMPIA
// ==========================================================

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
import { ModalidadProducto } from './ModalidadProducto.model';
import { StockPorBodega } from './StockPorBodega.model';

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

  // RELACIONES
  @BelongsTo(() => Producto, 'id_producto')
  producto!: Producto;

  @HasMany(() => ModalidadProducto, 'id_variante_producto')
  modalidades!: ModalidadProducto[];

  @HasMany(() => StockPorBodega, 'id_variante_producto')
  stockPorBodega!: StockPorBodega[];

  // MÉTODOS

  getModalidadesActivas(): ModalidadProducto[] {
    return this.modalidades?.filter(m => m.activa) || [];
  }

  calcularStockTotal(): number {
    return this.stockPorBodega?.reduce((total, stock) => total + stock.cantidad_disponible, 0) || 0;
  }

  getDescripcionCompleta(): string {
    const partes: string[] = [];
    
    if (this.color) partes.push(this.color);
    if (this.medida) partes.push(`Med. ${this.medida}`);
    if (this.material) partes.push(this.material);
    
    return partes.length > 0 ? partes.join(' - ') : 'Estándar';
  }

  tieneStock(cantidad: number = 1): boolean {
    return this.calcularStockTotal() >= cantidad;
  }

  obtenerStockEnBodega(idBodega: number): number {
    const stock = this.stockPorBodega?.find(s => s.id_bodega === idBodega);
    return stock?.cantidad_disponible || 0;
  }

  getModalidadMasEconomica(): ModalidadProducto | null {
    const modalidades = this.getModalidadesActivas();
    if (modalidades.length === 0) return null;
    
    return modalidades.reduce((min, current) => 
      current.precio_neto < min.precio_neto ? current : min
    );
  }

  getRangoPrecios(tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): { minimo: number; maximo: number } {
    const modalidades = this.getModalidadesActivas();
    
    if (modalidades.length === 0) {
      return { minimo: 0, maximo: 0 };
    }

    const precios = modalidades.map(m => 
      m.obtenerPrecioPorTipoDocumento(tipoDocumento)
    );

    return {
      minimo: Math.min(...precios),
      maximo: Math.max(...precios)
    };
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

// ==========================================================
// INTERFACES LIMPIAS
// ==========================================================

export interface CrearProductoRequest {
  categoria: string;
  tipo?: string;
  nombre: string;
  descripcion?: string;
  unidad_medida: 'metro' | 'unidad' | 'kilogramo' | 'litros';
  variantes: CrearVarianteRequest[];
}

export interface CrearVarianteRequest {
  sku?: string;
  color?: string;
  medida?: string;
  material?: string;
  descripcion?: string;
  modalidades: CrearModalidadRequest[];
}

export interface CrearModalidadRequest {
  nombre: string;
  descripcion?: string;
  cantidad_base?: number;
  es_cantidad_variable?: boolean;
  minimo_cantidad?: number;
  precio_costo?: number;
  precio_neto: number;
  precio_factura: number;
}

export interface FiltrosBusqueda {
  termino?: string;
  categoria?: string;
  tipo?: string;
  color?: string;
  medida?: string;
  material?: string;
  precio_min?: number;
  precio_max?: number;
  con_stock?: boolean;
  sku?: string;
}

export interface ProductoResponse {
  id: number;
  categoria: string;
  tipo?: string;
  nombre: string;
  codigo: string;
  descripcion_completa: string;
  unidad_medida: string;
  total_variantes: number;
  variantes: VarianteResponse[];
}

export interface VarianteResponse {
  id: number;
  sku: string;
  color?: string;
  medida?: string;
  material?: string;
  descripcion: string;
  stock_total: number;
  tiene_stock: boolean;
  modalidades: ModalidadResponse[];
}

export interface ModalidadResponse {
  id: number;
  nombre: string;
  descripcion?: string;
  precio_neto: number;
  precio_final: number;
  es_variable: boolean;
  cantidad_minima: number;
}