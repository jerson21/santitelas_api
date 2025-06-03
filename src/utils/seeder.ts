// src/utils/seeder.ts - VERSIÓN CORREGIDA QUE FUNCIONA
import { 
  Rol, 
  Usuario, 
  Categoria, 
  TipoDocumento,
  Bodega,
  MetodoPago,
  Caja 
} from '../models';

export async function seedDatabase() {
  try {
    console.log('🌱 Iniciando siembra de datos básicos (solo usuarios y configuración)...');

    await createRoles();
    await createUsers();
    /* await createCategories();
    await createDocumentTypes();
    await createWarehouses();
    await createPaymentMethods();
    await createCashRegisters();*/

    console.log('');
    console.log('🌱 ¡Siembra de configuración básica completada!');
    console.log('');
    console.log('📝 Usuarios creados:');
    console.log('   👤 admin / admin123 (Administrador)');
    console.log('   👤 cajero1 / cajero123 (Cajero)');
    console.log('   👤 vendedor1 / vendedor123 (Vendedor)');
    console.log('');
    console.log('📦 Los productos se mantienen desde el script SQL');

    // ✅ VERIFICAR QUE LAS CONTRASEÑAS FUNCIONEN
    await verifyCreatedUsers();

  } catch (error) {
    console.error('❌ Error en la siembra de datos:', error);
    throw error;
  }
}

// ===== FUNCIONES AUXILIARES CORREGIDAS =====

async function createRoles() {
  console.log('👔 Creando roles...');
  
  // ✅ CORREGIDO: Estructura simple compatible con tu modelo
  const rolesData = [
    {
      id_rol: 1,
      nombre_rol: 'admin',
      descripcion: 'Administrador del sistema'
    },
    {
      id_rol: 2,
      nombre_rol: 'cajero',
      descripcion: 'Cajero del punto de venta'
    },
    {
      id_rol: 3,
      nombre_rol: 'vendedor',
      descripcion: 'Vendedor del punto de venta'
    }
  ];

  for (const rolData of rolesData) {
    try {
      const [rol, created] = await Rol.findOrCreate({
        where: { id_rol: rolData.id_rol },
        defaults: rolData
      });
      
      if (created) {
        console.log(`✅ Rol creado: ${rol.nombre_rol}`);
      } else {
        console.log(`ℹ️  Rol ya existe: ${rol.nombre_rol}`);
      }
    } catch (error) {
      console.error(`❌ Error creando rol ${rolData.nombre_rol}:`, error);
    }
  }

  console.log('✅ Roles procesados');
}

async function createUsers() {
  console.log('👤 Creando usuarios...');
  
  // ✅ CORREGIDO: Estructura compatible con tu modelo Usuario
  const usersData = [
    {
      usuario: 'admin',
      password_hash: 'admin123', // ✅ CORREGIDO: Usar password_hash
      nombre_completo: 'Administrador del Sistema',
      email: 'admin@santitelas.cl',
      id_rol: 1,
      activo: true
    },
    {
      usuario: 'cajero1',
      password_hash: 'cajero123', // ✅ CORREGIDO: Usar password_hash
      nombre_completo: 'María González',
      email: 'maria@santitelas.cl',
      id_rol: 2,
      activo: true
    },
    {
      usuario: 'vendedor1',
      password_hash: 'vendedor123', // ✅ CORREGIDO: Usar password_hash
      nombre_completo: 'Juan Pérez',
      email: 'juan@santitelas.cl',
      id_rol: 3,
      activo: true
    }
  ];

  for (const userData of usersData) {
    await createUserSafely(userData);
  }

  console.log('✅ Usuarios procesados');
}

async function createUserSafely(userData: any) {
  try {
    // ✅ VERIFICAR SI EL USUARIO YA EXISTE
    let user = await Usuario.findOne({ 
      where: { usuario: userData.usuario } 
    });

    if (user) {
      console.log(`ℹ️  Usuario ${userData.usuario} ya existe`);
      
      // ✅ VERIFICAR SI LA CONTRASEÑA FUNCIONA
      try {
        const passwordWorks = await user.verificarPassword(userData.password_hash);
        if (!passwordWorks) {
          console.log(`🔄 Actualizando contraseña para ${userData.usuario}...`);
          
          // ✅ ACTUALIZAR CONTRASEÑA (el hook @BeforeUpdate la hasheará)
          await user.update({ 
            password_hash: userData.password_hash,
            activo: true 
          });
          
          console.log(`✅ Contraseña actualizada para ${userData.usuario}`);
        } else {
          console.log(`✅ Usuario ${userData.usuario} con contraseña correcta`);
        }
      } catch (error) {
        console.log(`🔄 Error verificando contraseña, actualizando ${userData.usuario}...`);
        await user.update({ 
          password_hash: userData.password_hash,
          activo: true 
        });
        console.log(`✅ Contraseña forzada para ${userData.usuario}`);
      }
      
    } else {
      console.log(`🆕 Creando usuario ${userData.usuario}...`);
      
      // ✅ CREAR NUEVO USUARIO (el hook @BeforeCreate hasheará la contraseña)
      const newUser = await Usuario.create(userData);
      
      console.log(`✅ Usuario ${userData.usuario} creado con ID: ${newUser.id_usuario}`);
    }
    
  } catch (error) {
    console.error(`❌ Error procesando usuario ${userData.usuario}:`, error);
    
    // ✅ INTENTO DE RECUPERACIÓN: Crear sin validaciones estrictas
    try {
      console.log(`🔄 Intentando crear ${userData.usuario} sin validaciones...`);
      
      await Usuario.create(userData, {
        validate: false,
        hooks: true // ✅ IMPORTANTE: Asegurar que los hooks se ejecuten
      });
      
      console.log(`✅ Usuario ${userData.usuario} creado en modo recuperación`);
      
    } catch (recoveryError) {
      console.error(`❌ Error definitivo creando ${userData.usuario}:`, recoveryError);
    }
  }
}

// ✅ NUEVA FUNCIÓN: Verificar que los usuarios funcionan
async function verifyCreatedUsers() {
  console.log('');
  console.log('🧪 Verificando usuarios creados...');
  
  const testUsers = [
    { usuario: 'admin', password: 'admin123' },
    { usuario: 'cajero1', password: 'cajero123' },
    { usuario: 'vendedor1', password: 'vendedor123' }
  ];

  for (const testUser of testUsers) {
    try {
      const user = await Usuario.findOne({ 
        where: { usuario: testUser.usuario },
        include: [{ model: Rol, as: 'rol' }]
      });
      
      if (user) {
        console.log(`👤 ${user.usuario} - ${user.nombre_completo}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👔 Rol: ${user.rol?.nombre_rol || 'Sin rol'}`);
        console.log(`   🔑 Hash: ${user.password_hash?.substring(0, 15)}...`);
        
        // ✅ VERIFICAR QUE LA CONTRASEÑA FUNCIONA
        try {
          const passwordWorks = await user.verificarPassword(testUser.password);
          console.log(`   ${passwordWorks ? '✅' : '❌'} Login: ${passwordWorks ? 'FUNCIONA' : 'NO FUNCIONA'}`);
        } catch (error) {
          console.log(`   ❌ Error verificando: ${error.message}`);
        }
        
      } else {
        console.log(`❌ Usuario ${testUser.usuario} no encontrado`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error verificando ${testUser.usuario}:`, error);
    }
  }
}

// ✅ FUNCIONES OPCIONALES (comentadas por ahora)
/*
async function createCategories() {
  await Categoria.bulkCreate([
    { nombre: 'TELAS', descripcion: 'Telas de diferentes tipos y materiales', activa: true },
    { nombre: 'ACCESORIOS', descripcion: 'Accesorios de costura y mercería', activa: true },
    { nombre: 'HILOS', descripcion: 'Hilos para costura y bordado', activa: true },
    { nombre: 'BOTONES', descripcion: 'Botones de diferentes tipos y tamaños', activa: true }
  ], { 
    ignoreDuplicates: true,
    updateOnDuplicate: ['descripcion', 'activa']
  });

  console.log('✅ Categorías básicas creadas/actualizadas');
}
*/