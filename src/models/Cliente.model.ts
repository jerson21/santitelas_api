// src/models/Cliente.model.ts
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasMany
} from 'sequelize-typescript';
import { Pedido } from './Pedido.model';

@Table({
  tableName: 'clientes',
  timestamps: false
})
export class Cliente extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_cliente!: number;

  @Column({
    type: DataType.STRING(15),
    allowNull: false,
    unique: true
  })
  rut!: string;

  @Column({
    type: DataType.ENUM('persona', 'empresa'),
    allowNull: false
  })
  tipo_cliente!: string;

  // Datos básicos
  @Column({
    type: DataType.STRING(100)
  })
  nombre?: string;

  @Column({
    type: DataType.STRING(100)
  })
  nombre_fantasia?: string;

  @Column({
    type: DataType.STRING(20)
  })
  codigo_cliente?: string;

  @Column({
    type: DataType.STRING(20)
  })
  telefono?: string;

  @Column({
    type: DataType.STRING(20)
  })
  celular?: string;

  @Column({
    type: DataType.STRING(100)
  })
  email?: string;

  // Datos empresa/facturación
  @Column({
    type: DataType.STRING(100)
  })
  razon_social?: string;

  @Column(DataType.TEXT)
  direccion?: string;

  @Column({
    type: DataType.STRING(100)
  })
  ciudad?: string;

  @Column({
    type: DataType.STRING(100)
  })
  comuna?: string;

  @Column({
    type: DataType.STRING(200)
  })
  giro?: string;

  // Contacto de pago
  @Column({
    type: DataType.STRING(100)
  })
  contacto_pago?: string;

  @Column({
    type: DataType.STRING(100)
  })
  email_pago?: string;

  @Column({
    type: DataType.STRING(20)
  })
  telefono_pago?: string;

  // Contacto comercial
  @Column({
    type: DataType.STRING(100)
  })
  contacto_comercial?: string;

  @Column({
    type: DataType.STRING(200)
  })
  email_comercial?: string;

  // Configuración de crédito y descuentos
  @Column({
    type: DataType.DECIMAL(5, 2),
    defaultValue: 0
  })
  descuento_default?: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    defaultValue: 0
  })
  linea_credito?: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  dias_credito?: number;

  @Column({
    type: DataType.STRING(50)
  })
  forma_pago_default?: string;

  @Column({
    type: DataType.STRING(50)
  })
  lista_precios?: string;

  // Control de morosidad
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  restringir_si_vencido?: boolean;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  dias_adicionales_morosidad?: number;

  // Control
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  activo!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  datos_completos!: boolean;

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

  // Relaciones
  pedidos!: Pedido[];

  // Métodos helper
  esEmpresa(): boolean {
    return this.tipo_cliente === 'empresa';
  }

  requiereCompletarDatos(): boolean {
    if (this.tipo_cliente === 'empresa') {
      return !this.razon_social || !this.direccion;
    }
    return false;
  }

  getNombreCompleto(): string {
    if (this.tipo_cliente === 'empresa') {
      return this.razon_social || this.nombre || 'Empresa sin nombre';
    }
    return this.nombre || 'Cliente sin nombre';
  }

  getNombreDisplay(): string {
    return this.nombre_fantasia || this.razon_social || this.nombre || 'Sin nombre';
  }

  getCreditoDisponible(montoUtilizado: number): number {
    const linea = Number(this.linea_credito) || 0;
    return Math.max(0, linea - montoUtilizado);
  }
}
