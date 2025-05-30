﻿// src/models/ModalidadProducto.model.ts - VERSIÓN CORREGIDA PARA NUEVA BD
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo, 
  ForeignKey,
  Index
} from 'sequelize-typescript';
import { VarianteProducto } from './VarianteProducto.model';

@Table({
  tableName: 'modalidades_producto',
  timestamps: false,
  indexes: [
    { fields: ['activa'] },
    { fields: ['precio_neto'] },
    { fields: ['id_variante_producto', 'nombre'], unique: true }
  ]
})
export class ModalidadProducto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_modalidad!: number;

  // ✅ CAMBIO CRÍTICO: Ahora apunta a variante específica
  @ForeignKey(() => VarianteProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_variante_producto!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false
  })
  nombre!: string; // "METRO", "ROLLO", "UNIDAD", "EMBALAJE"

  @Column({
    type: DataType.STRING(100),
    allowNull: true
  })
  descripcion?: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  cantidad_base!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  es_cantidad_variable!: boolean;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  minimo_cantidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    defaultValue: 0
  })
  precio_costo!: number;

  @Index
  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_neto!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_neto_factura!: number;

  // Calculado en runtime
  get precio_con_iva(): number {
    return Math.round(Number(this.precio_neto_factura) * 1.19);
  }

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

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_actualizacion!: Date;

  // ✅ RELACIÓN CORREGIDA: Con VarianteProducto
  varianteProducto!: VarianteProducto;

  // ✅ MÉTODOS ACTUALIZADOS
  obtenerPrecioPorTipoDocumento(tipoDocumento: 'ticket' | 'boleta' | 'factura'): number {
    switch (tipoDocumento) {
      case 'ticket':
      case 'boleta':
        return Number(this.precio_neto);
      case 'factura':
        return Number(this.precio_neto_factura);
      default:
        return Number(this.precio_neto);
    }
  }

  validarCantidad(cantidad: number): { valida: boolean; mensaje?: string } {
    if (cantidad <= 0) {
      return { valida: false, mensaje: 'La cantidad debe ser mayor a 0' };
    }
    
    if (this.minimo_cantidad > 0 && cantidad < this.minimo_cantidad) {
      return { 
        valida: false, 
        mensaje: `Cantidad mínima requerida: ${this.minimo_cantidad}` 
      };
    }
    
    // Validar decimales según es_cantidad_variable
    if (!this.es_cantidad_variable && cantidad % 1 !== 0) {
      return {
        valida: false,
        mensaje: 'Esta modalidad requiere cantidades enteras'
      };
    }
    
    return { valida: true };
  }

  calcularSubtotal(cantidad: number, tipoDocumento: 'ticket' | 'boleta' | 'factura' = 'ticket'): number {
    const precio = this.obtenerPrecioPorTipoDocumento(tipoDocumento);
    return Math.round(Number(cantidad) * precio);
  }

  getDescripcionCompleta(): string {
    if (this.descripcion) {
      return `${this.nombre} - ${this.descripcion}`;
    }
    return this.nombre;
  }

  esParaMetros(): boolean {
    return this.nombre.toLowerCase().includes('metro');
  }

  esParaRollos(): boolean {
    return this.nombre.toLowerCase().includes('rollo');
  }

  esParaEmbalajes(): boolean {
    return this.nombre.toLowerCase().includes('embalaje') || 
           this.nombre.toLowerCase().includes('pack') ||
           this.nombre.toLowerCase().includes('set');
  }
}