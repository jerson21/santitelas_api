// src/models/Producto.model.ts - VERSIÓN CORREGIDA CON MODALIDADES
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo, 
  ForeignKey, 
  HasMany,
  Index
} from 'sequelize-typescript';
import { Categoria } from './Categoria.model';
import { VarianteProducto } from './VarianteProducto.model';
import { ModalidadProducto } from './ModalidadProducto.model'; // ✅ AGREGAR IMPORT

@Table({
  tableName: 'productos',
  timestamps: false,
  indexes: [
    { fields: ['codigo'] },
    { fields: ['activo'] },
    { fields: ['tipo'] },
    { fields: ['nombre'] }
  ]
})
export class Producto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_producto!: number;

  @Column({
    type: DataType.STRING(50),
    unique: true,
    allowNull: false
  })
  codigo!: string;

  @Column({ 
    type: DataType.STRING(100), 
    allowNull: false 
  })
  nombre!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @ForeignKey(() => Categoria)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_categoria!: number;

  @Index
  @Column({
    type: DataType.STRING(50),
    allowNull: true
  })
  tipo?: string;

  @Column({ 
    type: DataType.DECIMAL(10, 2), 
    defaultValue: 0 
  })
  stock_minimo_total!: number;

  @Column({ 
    type: DataType.ENUM('metro', 'unidad', 'kilogramo', 'litros'), 
    defaultValue: 'unidad' 
  })
  unidad_medida!: string;

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

  @Column({ 
  type: DataType.DECIMAL(12, 2), 
  allowNull: false,
  defaultValue: 0
})
precio_costo!: number;

  // ✅ RELACIONES CORREGIDAS
  @BelongsTo(() => Categoria, 'id_categoria')
  categoria!: Categoria;

  @HasMany(() => VarianteProducto, 'id_producto')
  variantes!: VarianteProducto[];

  // ✅ AGREGAR RELACIÓN CON MODALIDADES
  @HasMany(() => ModalidadProducto, 'id_producto')
  modalidades!: ModalidadProducto[];

  // ✅ MÉTODOS CORREGIDOS
  getVariantesActivas(): VarianteProducto[] {
    return this.variantes?.filter(v => v.activo) || [];
  }

  // ✅ NUEVO: Obtener modalidades activas
  getModalidadesActivas(): ModalidadProducto[] {
    return this.modalidades?.filter(m => m.activa) || [];
  }

  calcularStockTotal(): number {
    if (!this.variantes) return 0;
    
    return this.variantes.reduce((total, variante) => {
      return total + variante.calcularStockTotal();
    }, 0);
  }

  // ✅ CORREGIDO: Obtener rangos de precios desde modalidades del producto
  getRangoPrecios(tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): { minimo: number; maximo: number } {
    const modalidades = this.getModalidadesActivas();
    
    if (modalidades.length === 0) {
      return { minimo: 0, maximo: 0 };
    }

    const precios: number[] = [];
    
    modalidades.forEach(modalidad => {
      precios.push(modalidad.obtenerPrecioPorTipoDocumento(tipoDocumento));
    });

    if (precios.length === 0) {
      return { minimo: 0, maximo: 0 };
    }

    return {
      minimo: Math.min(...precios),
      maximo: Math.max(...precios)
    };
  }

  getDescripcionCompleta(): string {
    let descripcion = '';
    
    if (this.tipo) {
      descripcion += `${this.tipo} `;
    }
    
    descripcion += this.nombre;
    
    return descripcion.trim();
  }

  getDescripcionVendedor(): string {
    let descripcion = this.getDescripcionCompleta();
    
    if (this.codigo) {
      descripcion += ` (${this.codigo})`;
    }
    
    return descripcion;
  }

  esDeTipo(tipo: string): boolean {
    if (!this.tipo) return false;
    return this.tipo.toLowerCase() === tipo.toLowerCase();
  }

  buscarVariante(filtros: {
    color?: string;
    medida?: string;
    material?: string;
    sku?: string;
  }): VarianteProducto | null {
    const variantes = this.getVariantesActivas();
    
    return variantes.find(variante => {
      let coincide = true;
      
      if (filtros.color && variante.color !== filtros.color) coincide = false;
      if (filtros.medida && variante.medida !== filtros.medida) coincide = false;
      if (filtros.material && variante.material !== filtros.material) coincide = false;
      if (filtros.sku && variante.sku !== filtros.sku) coincide = false;
      
      return coincide;
    }) || null;
  }

  // ✅ CORREGIDO: Usar modalidades del producto
  getEstadisticas(): {
    total_variantes: number;
    total_modalidades: number;
    stock_total: number;
    precio_minimo: number;
    precio_maximo: number;
    colores_disponibles: string[];
    medidas_disponibles: string[];
    materiales_disponibles: string[];
  } {
    const variantes = this.getVariantesActivas();
    const modalidades = this.getModalidadesActivas();
    
    const colores = new Set<string>();
    const medidas = new Set<string>();
    const materiales = new Set<string>();

    variantes.forEach(variante => {
      if (variante.color) colores.add(variante.color);
      if (variante.medida) medidas.add(variante.medida);
      if (variante.material) materiales.add(variante.material);
    });

    const precios = this.getRangoPrecios();

    return {
      total_variantes: variantes.length,
      total_modalidades: modalidades.length,
      stock_total: this.calcularStockTotal(),
      precio_minimo: precios.minimo,
      precio_maximo: precios.maximo,
      colores_disponibles: Array.from(colores).sort(),
      medidas_disponibles: Array.from(medidas).sort(),
      materiales_disponibles: Array.from(materiales).sort()
    };
  }
}