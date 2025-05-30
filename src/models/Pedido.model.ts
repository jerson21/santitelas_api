// src/models/Pedido.model.ts
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
  HasOne
} from 'sequelize-typescript';
import { Usuario } from './Usuario.model';
import { Cliente } from './Cliente.model';
import { DetallePedido } from './DetallePedido.model';
import { Venta } from './Venta.model';

// Define un tipo para el estado de pedido
export type EstadoPedido =
  | 'borrador'
  | 'pendiente'
  | 'vale_pendiente'
  | 'procesando_caja'
  | 'pagado_datos_pendientes'
  | 'completado'
  | 'cancelado';

@Table({
  tableName: 'pedidos',
  timestamps: false
})
export class Pedido extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_pedido!: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true
  })
  numero_pedido!: string;

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_vendedor!: number;

  @ForeignKey(() => Cliente)
  @Column({
    type: DataType.INTEGER
  })
  id_cliente?: number;

  // TOTALES
  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  subtotal!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  descuento!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  total!: number;

  // TIPO DE DOCUMENTO
  @Column({
    type: DataType.ENUM('ticket', 'boleta', 'factura'),
    defaultValue: 'ticket'
  })
  tipo_documento!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  datos_completos!: boolean;

  // Estado pedido (usa el tipo definido arriba)
  @Column({
    type: DataType.ENUM(
      'borrador',
      'pendiente',
      'vale_pendiente',
      'procesando_caja',
      'pagado_datos_pendientes',
      'completado',
      'cancelado'
    ),
    defaultValue: 'borrador'
  })
  estado!: EstadoPedido;

  @Column(DataType.TEXT)
  observaciones?: string;

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
  vendedor!: Usuario;

  cliente?: Cliente;

  detalles!: DetallePedido[];

  venta?: Venta;

  // ===== MÃ‰TODOS DE NEGOCIO Y HELPERS =====

  calcularTotales() {
    this.total = Number(this.subtotal) - Number(this.descuento);
  }

  esVale(): boolean {
    return ['vale_pendiente', 'procesando_caja'].includes(this.estado);
  }

  getEstadoDescripcion(): string {
    // Cast para asegurar el key type
    const descripciones: Record<EstadoPedido, string> = {
      borrador: 'En proceso',
      pendiente: 'Listo para procesar',
      vale_pendiente: 'ðŸ“‹ Esperando en caja',
      procesando_caja: 'â³ Procesando pago',
      pagado_datos_pendientes: 'ðŸ’° Pagado - Faltan datos',
      completado: 'âœ… Completado',
      cancelado: 'âŒ Cancelado'
    };
    return descripciones[this.estado] || this.estado;
  }

  puedeModificar(): boolean {
    return ['borrador', 'vale_pendiente'].includes(this.estado);
  }

  puedeCancelar(): boolean {
    return ['borrador', 'pendiente', 'vale_pendiente', 'procesando_caja'].includes(this.estado);
  }

  necesitaCompletarDatos(): boolean {
    return this.estado === 'pagado_datos_pendientes' ||
      (this.tipo_documento === 'factura' && !this.datos_completos);
  }

  getNombreCliente(): string {
    if (this.cliente && (this.cliente as any).getNombreCompleto) {
      return (this.cliente as any).getNombreCompleto();
    }
    if (this.cliente && (this.cliente as any).nombre) {
      return (this.cliente as any).nombre;
    }
    switch (this.tipo_documento) {
      case 'ticket':
        return 'Cliente anÃ³nimo';
      case 'factura':
        return 'Empresa (datos pendientes)';
      default:
        return 'Cliente express';
    }
  }

  puedeProcesamientoPago(): boolean {
    return ['vale_pendiente', 'procesando_caja'].includes(this.estado);
  }
}
