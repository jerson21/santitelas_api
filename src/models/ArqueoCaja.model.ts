// ===========================
// src/models/ArqueoCaja.model.ts
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
import { TurnoCaja } from './TurnoCaja.model';

@Table({
  tableName: 'arqueos_caja',
  timestamps: false
})
export class ArqueoCaja extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_arqueo!: number;

  @ForeignKey(() => TurnoCaja)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_turno!: number;

  // Conteo de billetes
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  billetes_20000!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  billetes_10000!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  billetes_5000!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  billetes_2000!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  billetes_1000!: number;

  // Conteo de monedas
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  monedas_500!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  monedas_100!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  monedas_50!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  monedas_10!: number;

  // Totales
  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  total_contado!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  total_teorico!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0
  })
  diferencia!: number;

  @Column(DataType.TEXT)
  observaciones?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_arqueo!: Date;

  turno!: TurnoCaja;

  // MÃ©todos helpers
  calcularTotalContado(): void {
    this.total_contado = 
      (this.billetes_20000 * 20000) +
      (this.billetes_10000 * 10000) +
      (this.billetes_5000 * 5000) +
      (this.billetes_2000 * 2000) +
      (this.billetes_1000 * 1000) +
      (this.monedas_500 * 500) +
      (this.monedas_100 * 100) +
      (this.monedas_50 * 50) +
      (this.monedas_10 * 10);
  }

  calcularDiferencia(): void {
    this.diferencia = this.total_contado - this.total_teorico;
  }
}
