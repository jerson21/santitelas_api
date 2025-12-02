// src/models/Producto.model.ts - VERSIÓN CORREGIDA PARA NUEVA BD
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  Index
} from 'sequelize-typescript';
import { Categoria } from './Categoria.model';
import { VarianteProducto } from './VarianteProducto.model';

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

  // ✅ PLANTILLAS DE PRECIOS (OPCIONALES - para herencia a variantes)
  @Column({ 
    type: DataType.DECIMAL(10, 0), 
    defaultValue: 0 
  })
  precio_costo_base!: number;

  @Column({ 
    type: DataType.DECIMAL(10, 0), 
    defaultValue: 0 
  })
  precio_neto_base!: number;

  @Column({ 
    type: DataType.DECIMAL(10, 0), 
    defaultValue: 0 
  })
  precio_neto_factura_base!: number;

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

  // ✅ RELACIONES (definidas en index.ts setupAssociations)
  categoria!: Categoria;

  variantes!: VarianteProducto[];

  // ✅ MÉTODOS CORREGIDOS
  getVariantesActivas(): VarianteProducto[] {
    return this.variantes?.filter(v => v.activo) || [];
  }

  calcularStockTotal(): number {
    if (!this.variantes) return 0;
    
    return this.variantes.reduce((total, variante) => {
      return total + variante.calcularStockTotal();
    }, 0);
  }

  // ✅ CORREGIDO: Obtener rangos de precios desde modalidades de las variantes
  getRangoPrecios(tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): { minimo: number; maximo: number } {
    const precios: number[] = [];
    
    this.getVariantesActivas().forEach(variante => {
      if (variante.modalidades) {
        variante.modalidades.forEach(modalidad => {
          if (modalidad.activa) {
            precios.push(modalidad.obtenerPrecioPorTipoDocumento(tipoDocumento));
          }
        });
      }
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

  // ✅ CORREGIDO: Calcular estadísticas desde variantes y sus modalidades
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
    
    const colores = new Set<string>();
    const medidas = new Set<string>();
    const materiales = new Set<string>();
    let totalModalidades = 0;

    variantes.forEach(variante => {
      if (variante.color) colores.add(variante.color);
      if (variante.medida) medidas.add(variante.medida);
      if (variante.material) materiales.add(variante.material);
      
      // Contar modalidades activas de esta variante
      if (variante.modalidades) {
        totalModalidades += variante.modalidades.filter(m => m.activa).length;
      }
    });

    const precios = this.getRangoPrecios();

    return {
      total_variantes: variantes.length,
      total_modalidades: totalModalidades,
      stock_total: this.calcularStockTotal(),
      precio_minimo: precios.minimo,
      precio_maximo: precios.maximo,
      colores_disponibles: Array.from(colores).sort(),
      medidas_disponibles: Array.from(medidas).sort(),
      materiales_disponibles: Array.from(materiales).sort()
    };
  }

  // ✅ PLANTILLAS DE PRECIOS (para herencia a nuevas variantes)
  getPlantillaPrecios(): {
    precio_costo_base: number;
    precio_neto_base: number;
    precio_neto_factura_base: number;
  } {
    return {
      precio_costo_base: Number(this.precio_costo_base),
      precio_neto_base: Number(this.precio_neto_base),
      precio_neto_factura_base: Number(this.precio_neto_factura_base)
    };
  }

  actualizarPlantillaPrecios(precios: {
    precio_costo_base?: number;
    precio_neto_base?: number;
    precio_neto_factura_base?: number;
  }): void {
    if (precios.precio_costo_base !== undefined) {
      this.precio_costo_base = precios.precio_costo_base;
    }
    if (precios.precio_neto_base !== undefined) {
      this.precio_neto_base = precios.precio_neto_base;
    }
    if (precios.precio_neto_factura_base !== undefined) {
      this.precio_neto_factura_base = precios.precio_neto_factura_base;
    }
  }

  // ✅ MÉTODO PARA OBTENER TODAS LAS MODALIDADES DEL PRODUCTO
  getAllModalidades(): any[] {
    const modalidades: any[] = [];
    
    this.getVariantesActivas().forEach(variante => {
      if (variante.modalidades) {
        variante.modalidades.forEach(modalidad => {
          if (modalidad.activa) {
            modalidades.push({
              ...modalidad.toJSON(),
              variante: {
                id_variante_producto: variante.id_variante_producto,
                sku: variante.sku,
                color: variante.color,
                medida: variante.medida,
                material: variante.material
              }
            });
          }
        });
      }
    });

    return modalidades;
  }

  // ✅ MÉTODO PARA OBTENER DATOS COMPLETOS CON VARIANTES Y MODALIDADES
  getDatosCompletos(): any {
    return {
      id_producto: this.id_producto,
      codigo: this.codigo,
      nombre: this.nombre,
      descripcion: this.descripcion,
      tipo: this.tipo,
      unidad_medida: this.unidad_medida,
      stock_minimo_total: this.stock_minimo_total,
      descripcion_completa: this.getDescripcionCompleta(),
      variantes: this.getVariantesActivas().map(variante => variante.getDatosCompletos()),
      estadisticas: this.getEstadisticas(),
      plantilla_precios: this.getPlantillaPrecios(),
      categoria: this.categoria ? {
        id_categoria: this.categoria.id_categoria,
        nombre: this.categoria.nombre
      } : null
    };
  }

  // ✅ MÉTODOS DE VALIDACIÓN
  validar(): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!this.codigo || this.codigo.trim() === '') {
      errores.push('El código del producto es requerido');
    }

    if (!this.nombre || this.nombre.trim() === '') {
      errores.push('El nombre del producto es requerido');
    }

    if (!this.id_categoria) {
      errores.push('La categoría es requerida');
    }

    if (this.stock_minimo_total < 0) {
      errores.push('El stock mínimo no puede ser negativo');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  // ✅ MÉTODO PARA CREAR VARIANTE CON MODALIDADES AUTOMÁTICAS
  async crearVarianteConModalidades(datosVariante: {
    color?: string;
    medida?: string;
    material?: string;
    descripcion?: string;
    stock_minimo?: number;
  }): Promise<VarianteProducto> {
    // Generar SKU único
    const skuParts = [
      this.codigo,
      datosVariante.color?.substring(0, 3).toUpperCase(),
      datosVariante.medida,
      datosVariante.material?.substring(0, 3).toUpperCase()
    ].filter(Boolean);
    const skuBase = skuParts.join('-');
    
    // Verificar unicidad del SKU
    let sku = skuBase;
    let contador = 1;
    while (await VarianteProducto.findOne({ where: { sku } })) {
      sku = `${skuBase}-${contador}`;
      contador++;
    }

    // Crear la variante
    const variante = await VarianteProducto.create({
      id_producto: this.id_producto,
      sku,
      color: datosVariante.color,
      medida: datosVariante.medida,
      material: datosVariante.material,
      descripcion: datosVariante.descripcion,
      stock_minimo: datosVariante.stock_minimo || 0,
      activo: true
    });

    // Crear modalidades automáticas basadas en la unidad de medida
    const plantilla = this.getPlantillaPrecios();
    
    if (this.unidad_medida === 'metro') {
      // Para productos en metros: METRO y ROLLO
      await variante.$create('modalidad', {
        nombre: 'METRO',
        descripcion: 'Venta al corte por metro',
        cantidad_base: 1,
        es_cantidad_variable: true,
        minimo_cantidad: 0.1,
        precio_costo: plantilla.precio_costo_base,
        precio_neto: plantilla.precio_neto_base,
        precio_neto_factura: plantilla.precio_neto_factura_base,
        activa: true
      });

      await variante.$create('modalidad', {
        nombre: 'ROLLO',
        descripcion: 'Rollo completo',
        cantidad_base: 25,
        es_cantidad_variable: false,
        minimo_cantidad: 25,
        precio_costo: Math.round(plantilla.precio_costo_base * 0.9),
        precio_neto: Math.round(plantilla.precio_neto_base * 0.9),
        precio_neto_factura: Math.round(plantilla.precio_neto_factura_base * 0.9),
        activa: true
      });
    } else {
      // Para otros productos: UNIDAD
      await variante.$create('modalidad', {
        nombre: 'UNIDAD',
        descripcion: 'Venta por unidad',
        cantidad_base: 1,
        es_cantidad_variable: false,
        minimo_cantidad: 1,
        precio_costo: plantilla.precio_costo_base,
        precio_neto: plantilla.precio_neto_base,
        precio_neto_factura: plantilla.precio_neto_factura_base,
        activa: true
      });
    }

    return variante;
  }
}