// ===========================
// src/models/TurnoCaja.model.ts
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
import { Caja } from './Caja.model';
import { Usuario } from './Usuario.model';
import { Venta } from './Venta.model';
import { ArqueoCaja } from './ArqueoCaja.model';

@Table({
  tableName: 'turnos_caja',
  timestamps: false
})
export class TurnoCaja extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_turno!: number;

  @ForeignKey(() => Caja)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_caja!: number;

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_cajero!: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_apertura!: Date;

  @Column({
    type: DataType.DATE
  })
  fecha_cierre?: Date;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  monto_inicial!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  monto_teorico_cierre!: number;

  @Column({
    type: DataType.DECIMAL(10, 2)
  })
  monto_real_cierre?: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  diferencia!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  total_ventas!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  cantidad_ventas!: number;

  @Column({
    type: DataType.ENUM('abierto', 'cerrado'),
    defaultValue: 'abierto'
  })
  estado!: string;

  @Column(DataType.TEXT)
  observaciones_apertura?: string;

  @Column(DataType.TEXT)
  observaciones_cierre?: string;

  caja!: Caja;

  cajero!: Usuario;

  ventas!: Venta[];

  arqueo?: ArqueoCaja;

  // MÃ©todos helpers
  estaAbierto(): boolean {
    return this.estado === 'abierto';
  }

  calcularDiferencia(): void {
    if (this.monto_real_cierre !== null && this.monto_real_cierre !== undefined) {
      this.diferencia = this.monto_real_cierre - this.monto_teorico_cierre;
    }
  }
}
