// ===========================
// src/models/RetiroCaja.model.ts
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey
} from 'sequelize-typescript';
import { TurnoCaja } from './TurnoCaja.model';

@Table({
  tableName: 'retiros_caja',
  timestamps: false
})
export class RetiroCaja extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_retiro!: number;

  @ForeignKey(() => TurnoCaja)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_turno!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  monto!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  monto_caja_antes!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false
  })
  monto_caja_despues!: number;

  @Column({
    type: DataType.STRING(255)
  })
  motivo?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_retiro!: Date;

  turno!: TurnoCaja;
}
