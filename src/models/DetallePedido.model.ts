// src/models/DetallePedido.model.ts - ERRORES TS CORREGIDOS
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
import { Pedido } from './Pedido.model';
import { VarianteProducto } from './VarianteProducto.model';
import { ModalidadProducto } from './ModalidadProducto.model';
import { Usuario } from './Usuario.model';

@Table({
  tableName: 'detalle_pedidos',
  timestamps: false,
  indexes: [
    { fields: ['id_pedido'] },
    { fields: ['id_variante_producto'] },
    { fields: ['id_modalidad'] },
    { fields: ['tipo_precio'] }
  ]
})
export class DetallePedido extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_detalle!: number;

  @ForeignKey(() => Pedido)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_pedido!: number;

  @ForeignKey(() => VarianteProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_variante_producto!: number;

  @ForeignKey(() => ModalidadProducto)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_modalidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  cantidad!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  precio_unitario!: number;

  @Column({
    type: DataType.ENUM('neto', 'factura', 'personalizado'),
    defaultValue: 'neto'
  })
  tipo_precio!: 'neto' | 'factura' | 'personalizado';

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: true
  })
  precio_autorizado_por?: number;

  @Column({
    type: DataType.STRING(200),
    allowNull: true
  })
  motivo_precio_personalizado?: string;

  @Column({
    type: DataType.DECIMAL(10, 0),
    allowNull: false
  })
  subtotal!: number;

  @Column(DataType.TEXT)
  observaciones?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_creacion!: Date;

  // RELACIONES
  pedido!: Pedido;
  varianteProducto!: VarianteProducto;
  modalidad!: ModalidadProducto;
  usuarioAutorizador?: Usuario;

  // MÉTODOS
  calcularSubtotal(): number {
    return Math.round(this.cantidad * this.precio_unitario);
  }

  obtenerPrecioFinal(tipoDocumento: 'ticket' | 'boleta' | 'factura'): number {
    if (this.tipo_precio === 'personalizado') {
      return this.precio_unitario;
    }
    
    if (this.modalidad) {
      return this.modalidad.obtenerPrecioPorTipoDocumento(tipoDocumento);
    }
    
    return this.precio_unitario;
  }

  getDescripcionCompleta(): string {
    if (!this.varianteProducto || !this.modalidad) return 'Producto no encontrado';
    
    const producto = this.varianteProducto.producto;
    if (!producto) return 'Producto no encontrado';
    
    return `${producto.getDescripcionCompleta()} - ${this.varianteProducto.getDescripcionCompleta()} - ${this.modalidad.nombre}`;
  }

  getDescripcionCorta(): string {
    if (!this.varianteProducto || !this.modalidad) return 'Producto no encontrado';
    
    const producto = this.varianteProducto.producto;
    if (!producto) return 'Producto no encontrado';
    
    return `${producto.nombre} ${this.varianteProducto.getDescripcionCompleta()}`;
  }

  validarStock(): { valido: boolean; mensaje?: string } {
    if (!this.varianteProducto) {
      return { valido: false, mensaje: 'Variante de producto no encontrada' };
    }

    const stockDisponible = this.varianteProducto.calcularStockTotal();
    
    if (stockDisponible < this.cantidad) {
      return { 
        valido: false, 
        mensaje: `Stock insuficiente. Disponible: ${stockDisponible}, Solicitado: ${this.cantidad}` 
      };
    }

    return { valido: true };
  }

  // ✅ CORREGIDO: Consistencia en nombres de propiedades
  validarModalidad(): { valido: boolean; mensaje?: string } {
    if (!this.modalidad) {
      return { valido: false, mensaje: 'Modalidad no encontrada' };
    }

    if (!this.modalidad.activa) {
      return { valido: false, mensaje: 'La modalidad no está activa' };
    }

    // Validar que la modalidad pertenezca a la variante
    if (this.modalidad.id_variante_producto !== this.id_variante_producto) {
      return { 
        valido: false, 
        mensaje: 'La modalidad no pertenece a la variante seleccionada' 
      };
    }

    // Validar cantidad según modalidad
    const validacionCantidad = this.modalidad.validarCantidad(this.cantidad);
    if (!validacionCantidad.valida) {
      // ✅ CORREGIDO: Mapear valida → valido
      return {
        valido: false,
        mensaje: validacionCantidad.mensaje
      };
    }

    return { valido: true };
  }

  validarCompleto(): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    // Validar stock
    const validacionStock = this.validarStock();
    if (!validacionStock.valido && validacionStock.mensaje) {
      errores.push(validacionStock.mensaje);
    }

    // Validar modalidad
    const validacionModalidad = this.validarModalidad();
    if (!validacionModalidad.valido && validacionModalidad.mensaje) {
      errores.push(validacionModalidad.mensaje);
    }

    // Validar precio personalizado
    if (this.tipo_precio === 'personalizado' && !this.precio_autorizado_por) {
      errores.push('Precio personalizado requiere autorización');
    }

    // Validar cantidad mínima
    if (this.cantidad <= 0) {
      errores.push('La cantidad debe ser mayor a 0');
    }

    // Validar precio unitario
    if (this.precio_unitario <= 0) {
      errores.push('El precio unitario debe ser mayor a 0');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  getDatosParaVenta(): any {
    return {
      id_detalle: this.id_detalle,
      id_variante_producto: this.id_variante_producto,
      id_modalidad: this.id_modalidad,
      cantidad: this.cantidad,
      precio_unitario: this.precio_unitario,
      subtotal: this.subtotal,
      tipo_precio: this.tipo_precio,
      descripcion: this.getDescripcionCompleta(),
      descripcion_corta: this.getDescripcionCorta(),
      sku: this.varianteProducto?.sku,
      modalidad_nombre: this.modalidad?.nombre,
      observaciones: this.observaciones
    };
  }

  static async crearDetalle(datos: {
    id_pedido: number;
    id_variante_producto: number;
    id_modalidad: number;
    cantidad: number;
    precio_unitario: number;
    tipo_precio?: 'neto' | 'factura' | 'personalizado';
    observaciones?: string;
    precio_autorizado_por?: number;
    motivo_precio_personalizado?: string;
  }): Promise<DetallePedido> {
    const subtotal = Math.round(datos.cantidad * datos.precio_unitario);
    
    return await DetallePedido.create({
      ...datos,
      subtotal,
      tipo_precio: datos.tipo_precio || 'neto'
    });
  }
}