// src/models/Categoria.model.ts
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  HasMany 
} from 'sequelize-typescript';
import { Producto } from './Producto.model';

@Table({
  tableName: 'categorias',
  timestamps: false
})
export class Categoria extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_categoria!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true
  })
  nombre!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

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

  @HasMany(() => Producto, 'id_categoria')
  productos!: Producto[];
}
