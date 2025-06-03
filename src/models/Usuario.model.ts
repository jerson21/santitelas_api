﻿// src/models/Usuario.model.ts - VERSIÃ“N MEJORADA
import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  AutoIncrement, 
  BelongsTo,
  ForeignKey,
  BeforeCreate,
  BeforeUpdate,
  HasMany
} from 'sequelize-typescript';
import { Rol } from './Rol.model';
import { Pedido } from './Pedido.model';
import bcrypt from 'bcryptjs';

@Table({
  tableName: 'usuarios',
  timestamps: false
})
export class Usuario extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_usuario!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: 'unq_usuarios_usuario'
  })
  usuario!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false
  })
  password_hash!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false
  })
  nombre_completo!: string;

  @Column({
    type: DataType.STRING(100),
    unique: 'unq_usuarios_email'
  })
  email?: string;

  @Column({
    type: DataType.STRING(20)
  })
  telefono?: string;

  @ForeignKey(() => Rol)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_rol!: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  activo!: boolean;

  @Column({
    type: DataType.DATE
  })
  ultimo_acceso?: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_creacion!: Date;

  rol!: Rol;

  pedidos!: Pedido[];

  // âœ… HOOK MEJORADO - Funciona con create() y bulkCreate()
  @BeforeCreate
  static async hashPasswordOnCreate(usuario: Usuario) {
    console.log('ðŸ” Hook BeforeCreate - Hasheando contraseÃ±a para:', usuario.usuario);
    
    if (usuario.password_hash && !usuario.password_hash.startsWith('$2a$') && !usuario.password_hash.startsWith('$2b$')) {
      console.log('ðŸ”§ Generando hash para contraseÃ±a:', usuario.password_hash.substring(0, 3) + '***');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(usuario.password_hash, salt);
      
      usuario.password_hash = hashedPassword;
      console.log('âœ… Hash generado correctamente');
    } else {
      console.log('â„¹ï¸  ContraseÃ±a ya hasheada o vacÃ­a');
    }
  }

  @BeforeUpdate
  static async hashPasswordOnUpdate(usuario: Usuario) {
    console.log('ðŸ” Hook BeforeUpdate - Verificando contraseÃ±a para:', usuario.usuario);
    
    if (usuario.changed('password_hash')) {
      const newPassword = usuario.password_hash;
      
      // Solo hashear si no estÃ¡ ya hasheado
      if (newPassword && !newPassword.startsWith('$2a$') && !newPassword.startsWith('$2b$')) {
        console.log('ðŸ”§ Actualizando hash de contraseÃ±a');
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        usuario.password_hash = hashedPassword;
        console.log('âœ… Hash actualizado correctamente');
      }
    }
  }

  // âœ… MÃ‰TODO MEJORADO para verificar contraseÃ±a
  async verificarPassword(password: string): Promise<boolean> {
    try {
      if (!this.password_hash || !password) {
        return false;
      }
      
      const result = await bcrypt.compare(password, this.password_hash);
      console.log(`ðŸ” VerificaciÃ³n de contraseÃ±a para ${this.usuario}:`, result);
      
      return result;
    } catch (error) {
      console.error('âŒ Error verificando contraseÃ±a:', error);
      return false;
    }
  }

  // âœ… MÃ‰TODO ESTÃTICO para crear usuario con contraseÃ±a
  static async createWithPassword(userData: {
    usuario: string;
    password: string;
    nombre_completo: string;
    email?: string;
    telefono?: string;
    id_rol: number;
    activo?: boolean;
  }) {
    return await Usuario.create({
      ...userData,
      password_hash: userData.password // Se hashearÃ¡ automÃ¡ticamente
    });
  }

  toJSON() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    return values;
  }
}