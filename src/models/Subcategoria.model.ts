// ===== src/models/Subcategoria.model.ts =====
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo,
  ForeignKey,
  HasMany
} from 'sequelize-typescript';
import { Categoria } from './Categoria.model';
import { Producto } from './Producto.model';

@Table({
  tableName: 'subcategorias',
  timestamps: false
})
export class Subcategoria extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_subcategoria!: number;

  @ForeignKey(() => Categoria)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_categoria!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false
  })
  nombre!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({
    type: DataType.STRING(20)
  })
  codigo?: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0
  })
  orden!: number;

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

  // Asociaciones
  @BelongsTo(() => Categoria, 'id_categoria')
  categoria!: Categoria;

  @HasMany(() => Producto, 'id_subcategoria')
  productos!: Producto[];
}