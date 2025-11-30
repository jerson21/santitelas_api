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

  // Datos bÃ¡sicos
  @Column({
    type: DataType.STRING(100)
  })
  nombre?: string;

  @Column({
    type: DataType.STRING(20)
  })
  telefono?: string;

  @Column({
    type: DataType.STRING(100)
  })
  email?: string;

  // Datos empresa
  @Column({
    type: DataType.STRING(100)
  })
  razon_social?: string;

  @Column(DataType.TEXT)
  direccion?: string;

  @Column({
    type: DataType.STRING(100)
  })
  comuna?: string;

  @Column({
    type: DataType.STRING(200)
  })
  giro?: string;

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

  // MÃ©todos helper
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
}
