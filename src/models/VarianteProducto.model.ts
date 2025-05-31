// src/models/VarianteProducto.model.ts - VERSIÓN CORREGIDA PARA NUEVA BD
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
import { ModalidadProducto } from './ModalidadProducto.model';

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

  // ✅ RELACIONES CORREGIDAS
  producto!: Producto;

  stockPorBodega!: StockPorBodega[];

  movimientos!: MovimientoStock[];

  // ✅ NUEVA RELACIÓN: Modalidades por variante específica
  modalidades!: ModalidadProducto[];

  // ✅ MÉTODOS CORREGIDOS
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

  // ✅ NUEVOS MÉTODOS PARA MODALIDADES
  getModalidadesActivas(): ModalidadProducto[] {
    return this.modalidades?.filter(m => m.activa) || [];
  }

  buscarModalidad(nombre: string): ModalidadProducto | null {
    const modalidades = this.getModalidadesActivas();
    return modalidades.find(m => m.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  }

  getModalidadPorDefecto(): ModalidadProducto | null {
    const modalidades = this.getModalidadesActivas();
    if (modalidades.length === 0) return null;
    
    // Prioridad: METRO > UNIDAD > primera disponible
    const porPrioridad = modalidades.find(m => 
      m.nombre.toLowerCase().includes('metro') || 
      m.nombre.toLowerCase().includes('unidad')
    );
    
    return porPrioridad || modalidades[0];
  }

  getRangoPrecios(tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): { minimo: number; maximo: number } {
    const modalidades = this.getModalidadesActivas();
    
    if (modalidades.length === 0) {
      return { minimo: 0, maximo: 0 };
    }

    const precios = modalidades.map(m => m.obtenerPrecioPorTipoDocumento(tipoDocumento));
    
    return {
      minimo: Math.min(...precios),
      maximo: Math.max(...precios)
    };
  }

  // ✅ MÉTODO PARA OBTENER DATOS COMPLETOS PARA EL FRONTEND
  getDatosCompletos(): any {
    return {
      id_variante_producto: this.id_variante_producto,
      id_producto: this.id_producto,
      sku: this.sku,
      color: this.color,
      medida: this.medida,
      material: this.material,
      descripcion: this.descripcion,
      descripcion_completa: this.getDescripcionCompleta(),
      stock_total: this.calcularStockTotal(),
      tiene_stock: this.tieneStock(),
      modalidades_disponibles: this.getModalidadesActivas().map(modalidad => ({
        id_modalidad: modalidad.id_modalidad,
        nombre: modalidad.nombre,
        descripcion: modalidad.descripcion,
        cantidad_base: modalidad.cantidad_base,
        es_cantidad_variable: modalidad.es_cantidad_variable,
        minimo_cantidad: modalidad.minimo_cantidad,
        precio_costo: modalidad.precio_costo,
        precio_neto: modalidad.precio_neto,
        precio_neto_factura: modalidad.precio_neto_factura,
        precio_con_iva: modalidad.precio_con_iva
      })),
      rango_precios: this.getRangoPrecios()
    };
  }

  // ✅ MÉTODOS DE VALIDACIÓN
  validarModalidadCompatible(modalidad: ModalidadProducto): { valida: boolean; mensaje?: string } {
    if (modalidad.id_variante_producto !== this.id_variante_producto) {
      return {
        valida: false,
        mensaje: 'La modalidad no pertenece a esta variante'
      };
    }

    if (!modalidad.activa) {
      return {
        valida: false,
        mensaje: 'La modalidad no está activa'
      };
    }

    return { valida: true };
  }

  // ✅ MÉTODO PARA OBTENER EL ATRIBUTO PRINCIPAL DE LA VARIANTE
  getAtributoPrincipal(): { tipo: 'color' | 'medida' | 'material' | 'ninguno'; valor: string } {
    if (this.color) return { tipo: 'color', valor: this.color };
    if (this.medida) return { tipo: 'medida', valor: this.medida };
    if (this.material) return { tipo: 'material', valor: this.material };
    return { tipo: 'ninguno', valor: 'Estándar' };
  }

  // ✅ MÉTODO PARA COMPARAR CON OTRA VARIANTE
  esIgualA(otraVariante: VarianteProducto): boolean {
    return this.id_variante_producto === otraVariante.id_variante_producto;
  }

  esSimilarA(otraVariante: VarianteProducto): boolean {
    return this.id_producto === otraVariante.id_producto &&
           this.color === otraVariante.color &&
           this.medida === otraVariante.medida &&
           this.material === otraVariante.material;
  }
}