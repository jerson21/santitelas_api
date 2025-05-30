// src/models/TipoDocumento.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { Venta } from './Venta.model';

@Table({
  tableName: 'tipos_documento',
  timestamps: false
})
export class TipoDocumento extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_tipo_documento!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  nombre!: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    unique: true
  })
  codigo!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  requiere_rut_cliente!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  es_fiscal!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  aplica_iva!: boolean;

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

  @HasMany(() => Venta, 'id_tipo_documento')
  ventas!: Venta[];
}