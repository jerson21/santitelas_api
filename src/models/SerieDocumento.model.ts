// src/models/SerieDocumento.model.ts
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
import { TipoDocumento } from './TipoDocumento.model';
import { Venta } from './Venta.model';

@Table({
  tableName: 'series_documento',
  timestamps: false
})
export class SerieDocumento extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_serie!: number;

  @ForeignKey(() => TipoDocumento)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_tipo_documento!: number;

  @Column({
    type: DataType.STRING(10),
    allowNull: false
  })
  serie!: string;

  @Column(DataType.TEXT)
  descripcion?: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1
  })
  numero_inicial!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 99999999
  })
  numero_final!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1
  })
  numero_actual!: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1000
  })
  numero_alerta!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  activo!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false
  })
  es_principal!: boolean;

  @Column({
    type: DataType.STRING(100)
  })
  punto_venta?: string;

  @Column({
    type: DataType.STRING(50)
  })
  terminal?: string;

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

  // Asociaciones
  @BelongsTo(() => TipoDocumento, 'id_tipo_documento')
  tipoDocumento!: TipoDocumento;

  @HasMany(() => Venta, 'id_serie')
  ventas!: Venta[];

  // Métodos helpers
  obtenerSiguienteNumero(): number {
    if (this.numero_actual >= this.numero_final) {
      throw new Error(`Serie ${this.serie} ha alcanzado el número final`);
    }
    return this.numero_actual + 1;
  }

  incrementarNumero(): void {
    this.numero_actual = this.obtenerSiguienteNumero();
  }

  estaProximoAgotarse(): boolean {
    const numerosRestantes = this.numero_final - this.numero_actual;
    return numerosRestantes <= this.numero_alerta;
  }

  getPorcentajeUso(): number {
    const totalNumeros = this.numero_final - this.numero_inicial + 1;
    const numerosUsados = this.numero_actual - this.numero_inicial;
    return (numerosUsados / totalNumeros) * 100;
  }
}