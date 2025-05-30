// ===========================
// src/models/Caja.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { TurnoCaja } from './TurnoCaja.model';

@Table({
  tableName: 'cajas',
  timestamps: false
})
export class Caja extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_caja!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false
  })
  nombre!: string;

  @Column({
    type: DataType.STRING(100)
  })
  ubicacion?: string;

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

  @HasMany(() => TurnoCaja, 'id_caja')
  turnos!: TurnoCaja[];
}