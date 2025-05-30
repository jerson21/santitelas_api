// src/models/MetodoPago.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { Pago } from './Pago.model';

@Table({
  tableName: 'metodos_pago',
  timestamps: false
})
export class MetodoPago extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_metodo!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  nombre!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true
  })
  codigo!: string;

  @Column({
    type: DataType.ENUM('efectivo', 'tarjeta', 'transferencia', 'otro'),
    allowNull: false
  })
  tipo!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  requiere_referencia!: boolean;

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

  pagos!: Pago[];
}
