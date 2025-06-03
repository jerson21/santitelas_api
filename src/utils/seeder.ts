// src/utils/seeder.ts - VERSIÓN SOLO USUARIOS Y CONFIGURACIÓN BÁSICA
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
    await createCategories();
    await createDocumentTypes();
    await createWarehouses();
    await createPaymentMethods();
    await createCashRegisters();

    // ✅ NO CREAR PRODUCTOS - Los del script SQL están bien
    console.log('');
    console.log('🌱 ¡Siembra de configuración básica completada!');
    console.log('');
    console.log('📝 Usuarios creados:');
    console.log('   👤 admin / admin123 (Administrador)');
    console.log('   👤 cajero1 / cajero123 (Cajero)');
    console.log('   👤 vendedor1 / vendedor123 (Vendedor)');
    console.log('');
    console.log('📦 Los productos se mantienen desde el script SQL');

  } catch (error) {
    console.error('❌ Error en la siembra de datos:', error);
    throw error;
  }
}

// ===== FUNCIONES AUXILIARES =====

async function createRoles() {
  const rolesData = [
    {
      nombre: 'ADMINISTRADOR',
      descripcion: 'Acceso total al sistema',
      permisos: ['admin', 'ventas', 'productos', 'usuarios'],
      activo: true
    },
    {
      nombre: 'CAJERO',
      descripcion: 'Acceso a ventas y pagos',
      permisos: ['ventas', 'pagos'],
      activo: true
    },
    {
      nombre: 'VENDEDOR',
      descripcion: 'Acceso a pedidos y productos',
      permisos: ['pedidos', 'productos.ver'],
      activo: true
    }
  ];

  for (const rolData of rolesData) {
    await Rol.findOrCreate({
      where: { nombre: rolData.nombre },
      defaults: rolData
    });
  }

  console.log('✅ Roles creados');
}

async function createUsers() {
  const usersData = [
    {
      usuario: 'admin',
      password: 'admin123',
      nombre_completo: 'Administrador del Sistema',
      email: 'admin@santitelas.cl',
      id_rol: 1
    },
    {
      usuario: 'cajero1',
      password: 'cajero123',
      nombre_completo: 'María González',
      email: 'maria@santitelas.cl',
      id_rol: 2
    },
    {
      usuario: 'vendedor1',
      password: 'vendedor123',
      nombre_completo: 'Juan Pérez',
      email: 'juan@santitelas.cl',
      id_rol: 3
    }
  ];

  for (const userData of usersData) {
    await createUserSafely(userData);
  }

  console.log('✅ Usuarios creados con hashes correctos');
}

async function createUserSafely(userData: any) {
  let user = await Usuario.findOne({ where: { usuario: userData.usuario } });

  if (user) {
    // Si el usuario existe, verificar si la contraseña funciona
    const passwordWorks = await user.verificarPassword(userData.password);
    if (!passwordWorks) {
      // Si no funciona, actualizar el hash
      await user.update({ password_hash: userData.password, activo: true });
      console.log(`🔄 Actualizado hash de contraseña para ${userData.usuario}`);
    } else {
      console.log(`✅ Usuario ${userData.usuario} ya existe con contraseña correcta`);
    }
  } else {
    // Si no existe, crearlo
    await Usuario.createWithPassword(userData);
    console.log(`🆕 Usuario ${userData.usuario} creado`);
  }
}

async function createCategories() {
  await Categoria.bulkCreate([
    { nombre: 'TELAS', descripcion: 'Telas de diferentes tipos y materiales', activa: true },
    { nombre: 'ACCESORIOS', descripcion: 'Accesorios de costura y mercería', activa: true },
    { nombre: 'HILOS', descripcion: 'Hilos para costura y bordado', activa: true },
    { nombre: 'BOTONES', descripcion: 'Botones de diferentes tipos y tamaños', activa: true },
    { nombre: 'PATAS', descripcion: 'Patas y accesorios de costura', activa: true },
    { nombre: 'CORCHETES', descripcion: 'Corchetes metálicos de diferentes medidas', activa: true }
  ], { 
    ignoreDuplicates: true,
    updateOnDuplicate: ['descripcion', 'activa'] // Solo actualizar estos campos si ya existe
  });

  console.log('✅ Categorías básicas creadas/actualizadas');
}

async function createDocumentTypes() {
  await TipoDocumento.bulkCreate([
    {
      nombre: 'Ticket',
      codigo: 'TIC',
      requiere_rut_cliente: false,
      es_fiscal: false,
      aplica_iva: false,
      activo: true
    },
    {
      nombre: 'Boleta',
      codigo: 'BOL',
      requiere_rut_cliente: false,
      es_fiscal: false,
      aplica_iva: false,
      activo: true
    },
    {
      nombre: 'Factura',
      codigo: 'FAC',
      requiere_rut_cliente: true,
      es_fiscal: true,
      aplica_iva: true,
      activo: true
    }
  ], { ignoreDuplicates: true });

  console.log('✅ Tipos de documento creados');
}

async function createWarehouses() {
  await Bodega.bulkCreate([
    {
      codigo: 'SALA',
      nombre: 'Sala de Ventas',
      descripcion: 'Punto de venta principal',
      es_punto_venta: true,
      activa: true
    },
    {
      codigo: 'BOD1',
      nombre: 'Bodega Principal',
      descripcion: 'Almacén principal',
      es_punto_venta: false,
      activa: true
    },
    {
      codigo: 'BOD2',
      nombre: 'Bodega Secundaria',
      descripcion: 'Almacén de respaldo',
      es_punto_venta: false,
      activa: true
    }
  ], { ignoreDuplicates: true });

  console.log('✅ Bodegas creadas');
}

async function createPaymentMethods() {
  await MetodoPago.bulkCreate([
    { nombre: 'Efectivo', codigo: 'EFE', tipo: 'efectivo', requiere_referencia: false, activo: true },
    { nombre: 'Tarjeta Débito', codigo: 'DEB', tipo: 'tarjeta', requiere_referencia: true, activo: true },
    { nombre: 'Tarjeta Crédito', codigo: 'CRE', tipo: 'tarjeta', requiere_referencia: true, activo: true },
    { nombre: 'Transferencia', codigo: 'TRA', tipo: 'transferencia', requiere_referencia: true, activo: true }
  ], { ignoreDuplicates: true });

  console.log('✅ Métodos de pago creados');
}

async function createCashRegisters() {
  await Caja.bulkCreate([
    { nombre: 'Caja Principal', ubicacion: 'Mostrador 1', activa: true },
    { nombre: 'Caja Secundaria', ubicacion: 'Mostrador 2', activa: true }
  ], { ignoreDuplicates: true });

  console.log('✅ Cajas creadas');
}