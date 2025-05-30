// src/models/Rol.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { Usuario } from './Usuario.model';

@Table({
  tableName: 'roles',
  timestamps: false
})
export class Rol extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_rol!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  nombre!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({
    type: DataType.JSON,
    get() {
      const value = this.getDataValue('permisos');
      return typeof value === 'string' ? JSON.parse(value) : value;
    }
  })
  permisos?: string[];

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

  @HasMany(() => Usuario, 'id_rol')
  usuarios!: Usuario[];
}