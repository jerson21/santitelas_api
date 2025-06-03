// src/models/Usuario.model.ts - VERSIÓN ARREGLADA QUE FUNCIONA
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
  BeforeBulkCreate,
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

  @BelongsTo(() => Rol)
  rol!: Rol;

  @HasMany(() => Pedido)
  pedidos!: Pedido[];

  // ✅ HOOK ARREGLADO - BeforeCreate
  @BeforeCreate
  static async hashPasswordOnCreate(usuario: Usuario) {
    console.log('🔐 Hook BeforeCreate ejecutándose para:', usuario.usuario);
    
    if (usuario.password_hash) {
      // ✅ VERIFICAR si ya está hasheado
      const isAlreadyHashed = usuario.password_hash.startsWith('$2a$') || 
                            usuario.password_hash.startsWith('$2b$') ||
                            usuario.password_hash.length > 50;
      
      if (!isAlreadyHashed) {
        console.log('🔧 Hasheando contraseña nueva:', usuario.password_hash.substring(0, 3) + '***');
        
        try {
          const saltRounds = 10;
          const hashedPassword = await bcrypt.hash(usuario.password_hash, saltRounds);
          
          // ✅ USAR setDataValue para asegurar que se guarde
          usuario.setDataValue('password_hash', hashedPassword);
          console.log('✅ Hash generado y asignado correctamente');
          
        } catch (error) {
          console.error('❌ Error hasheando contraseña:', error);
          throw new Error('Error al hashear contraseña');
        }
      } else {
        console.log('ℹ️  Contraseña ya está hasheada, omitiendo');
      }
    }
  }

  // ✅ HOOK ARREGLADO - BeforeUpdate
  @BeforeUpdate
  static async hashPasswordOnUpdate(usuario: Usuario) {
    console.log('🔐 Hook BeforeUpdate ejecutándose para:', usuario.usuario);
    
    // ✅ SOLO hashear si la contraseña cambió
    if (usuario.changed('password_hash')) {
      const newPassword = usuario.getDataValue('password_hash');
      
      if (newPassword) {
        const isAlreadyHashed = newPassword.startsWith('$2a$') || 
                              newPassword.startsWith('$2b$') ||
                              newPassword.length > 50;
        
        if (!isAlreadyHashed) {
          console.log('🔧 Actualizando hash de contraseña');
          
          try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            usuario.setDataValue('password_hash', hashedPassword);
            console.log('✅ Hash actualizado correctamente');
            
          } catch (error) {
            console.error('❌ Error actualizando hash:', error);
            throw new Error('Error al actualizar hash de contraseña');
          }
        }
      }
    }
  }

  // ✅ HOOK NUEVO - Para bulkCreate (seeder)
  @BeforeBulkCreate
  static async hashPasswordsOnBulkCreate(usuarios: Usuario[]) {
    console.log(`🔐 Hook BeforeBulkCreate ejecutándose para ${usuarios.length} usuarios`);
    
    for (const usuario of usuarios) {
      if (usuario.password_hash) {
        const isAlreadyHashed = usuario.password_hash.startsWith('$2a$') || 
                              usuario.password_hash.startsWith('$2b$') ||
                              usuario.password_hash.length > 50;
        
        if (!isAlreadyHashed) {
          console.log(`🔧 Hasheando para ${usuario.usuario}`);
          
          try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(usuario.password_hash, saltRounds);
            
            // ✅ IMPORTANTE: En bulkCreate usar asignación directa
            usuario.password_hash = hashedPassword;
            
          } catch (error) {
            console.error(`❌ Error hasheando para ${usuario.usuario}:`, error);
            throw new Error(`Error al hashear contraseña para ${usuario.usuario}`);
          }
        }
      }
    }
    
    console.log('✅ Bulk hash completado');
  }

  // ✅ MÉTODO MEJORADO para verificar contraseña
  async verificarPassword(password: string): Promise<boolean> {
    try {
      if (!this.password_hash || !password) {
        console.log('⚠️  Contraseña o hash faltante');
        return false;
      }
      
      console.log(`🔍 Verificando contraseña para ${this.usuario}`);
      console.log(`🔑 Hash almacenado: ${this.password_hash.substring(0, 10)}...`);
      
      const result = await bcrypt.compare(password, this.password_hash);
      console.log(`${result ? '✅' : '❌'} Verificación: ${result}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error verificando contraseña:', error);
      return false;
    }
  }

  // ✅ MÉTODO ESTÁTICO mejorado para crear usuario
  static async createWithPassword(userData: {
    usuario: string;
    password: string;
    nombre_completo: string;
    email?: string;
    telefono?: string;
    id_rol: number;
    activo?: boolean;
  }) {
    console.log(`👤 Creando usuario: ${userData.usuario}`);
    
    try {
      const usuario = await Usuario.create({
        usuario: userData.usuario,
        password_hash: userData.password, // ✅ El hook lo hasheará
        nombre_completo: userData.nombre_completo,
        email: userData.email,
        telefono: userData.telefono,
        id_rol: userData.id_rol,
        activo: userData.activo ?? true
      });
      
      console.log(`✅ Usuario ${userData.usuario} creado con ID: ${usuario.id_usuario}`);
      return usuario;
      
    } catch (error) {
      console.error(`❌ Error creando usuario ${userData.usuario}:`, error);
      throw error;
    }
  }

  // ✅ MÉTODO para actualizar contraseña de forma segura
  async updatePassword(newPassword: string): Promise<boolean> {
    try {
      console.log(`🔄 Actualizando contraseña para: ${this.usuario}`);
      
      await this.update({
        password_hash: newPassword // ✅ El hook lo hasheará automáticamente
      });
      
      console.log(`✅ Contraseña actualizada para: ${this.usuario}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error actualizando contraseña para ${this.usuario}:`, error);
      return false;
    }
  }

  // ✅ MÉTODO para verificar si una contraseña ya está hasheada
  static isPasswordHashed(password: string): boolean {
    return password.startsWith('$2a$') || 
           password.startsWith('$2b$') || 
           password.length > 50;
  }

  // ✅ toJSON mejorado (ocultar contraseña)
  toJSON() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    return values;
  }
}

// ✅ INTERFAZ para tipado
export interface IUsuarioCreation {
  usuario: string;
  password: string;
  nombre_completo: string;
  email?: string;
  telefono?: string;
  id_rol: number;
  activo?: boolean;
}