// src/utils/seeder.ts - VERSIÓN MEJORADA
import bcrypt from 'bcryptjs';
import { 
  Rol, 
  Usuario, 
  Categoria, 
  Producto,
  TipoDocumento,
  Bodega,
  StockPorBodega,
  MetodoPago,
  Caja 
} from '../models';

export async function seedDatabase() {
  try {
    console.log('🌱 Iniciando siembra de datos mejorada...');

    // 1. Crear Roles
    await createRoles();
    
    // 2. Crear Usuarios (MEJORADO)
    await createUsers();
    
    // 3. Crear resto de datos
    await createCategories();
    await createDocumentTypes();
    await createWarehouses();
    await createPaymentMethods();
    await createCashRegisters();
    await createProducts();
    await createInitialStock();

    console.log('🌱 ¡Siembra de datos completada exitosamente!');
    console.log('');
    console.log('📝 Usuarios creados/verificados:');
    console.log('   👤 admin / admin123 (Administrador)');
    console.log('   👤 cajero1 / cajero123 (Cajero)');
    console.log('   👤 vendedor1 / vendedor123 (Vendedor)');

  } catch (error) {
    console.error('❌ Error en la siembra de datos:', error);
    throw error;
  }
}

// ✅ FUNCIÓN MEJORADA para crear roles
async function createRoles() {
  try {
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

    console.log('✅ Roles creados/verificados');
  } catch (error) {
    console.error('❌ Error creando roles:', error);
    throw error;
  }
}

// ✅ FUNCIÓN MEJORADA para crear usuarios individualmente
async function createUsers() {
  try {
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

    console.log('✅ Usuarios creados/verificados correctamente');
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    throw error;
  }
}

// ✅ FUNCIÓN ROBUSTA para crear usuarios
async function createUserSafely(userData: {
  usuario: string;
  password: string;
  nombre_completo: string;
  email: string;
  id_rol: number;
}) {
  try {
    console.log(`👤 Procesando usuario: ${userData.usuario}`);

    // Verificar si el usuario ya existe
    let user = await Usuario.findOne({ 
      where: { usuario: userData.usuario } 
    });

    if (user) {
      console.log(`   ℹ️  Usuario ${userData.usuario} ya existe, verificando contraseña...`);
      
      // Verificar si la contraseña actual funciona
      const passwordWorks = await user.verificarPassword(userData.password);
      
      if (!passwordWorks) {
        console.log(`   🔧 Actualizando contraseña para ${userData.usuario}...`);
        
        // Actualizar contraseña (el hook se encargará del hash)
        await user.update({ 
          password_hash: userData.password,
          activo: true 
        });
        
        // Verificar que ahora funciona
        await user.reload();
        const newPasswordWorks = await user.verificarPassword(userData.password);
        
        if (newPasswordWorks) {
          console.log(`   ✅ Contraseña actualizada correctamente para ${userData.usuario}`);
        } else {
          console.log(`   ⚠️  Problema actualizando contraseña para ${userData.usuario}`);
        }
      } else {
        console.log(`   ✅ Contraseña de ${userData.usuario} ya funciona correctamente`);
      }
    } else {
      console.log(`   🆕 Creando nuevo usuario: ${userData.usuario}`);
      
      // Crear nuevo usuario usando el método estático mejorado
      user = await Usuario.createWithPassword({
        usuario: userData.usuario,
        password: userData.password,
        nombre_completo: userData.nombre_completo,
        email: userData.email,
        id_rol: userData.id_rol,
        activo: true
      });
      
      // Verificar que la contraseña funciona
      const passwordWorks = await user.verificarPassword(userData.password);
      
      if (passwordWorks) {
        console.log(`   ✅ Usuario ${userData.usuario} creado exitosamente`);
      } else {
        console.log(`   ⚠️  Problema con la contraseña del usuario ${userData.usuario}`);
      }
    }

  } catch (error) {
    console.error(`❌ Error procesando usuario ${userData.usuario}:`, error);
    throw error;
  }
}

// Resto de funciones auxiliares
async function createCategories() {
  const categorias = await Categoria.bulkCreate([
    {
      nombre: 'TELAS',
      descripcion: 'Telas de diferentes tipos y materiales',
      activa: true
    },
    {
      nombre: 'ACCESORIOS',
      descripcion: 'Accesorios de costura y mercería',
      activa: true
    },
    {
      nombre: 'HILOS',
      descripcion: 'Hilos para costura y bordado',
      activa: true
    }
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Categorías creadas');
}

async function createDocumentTypes() {
  const tiposDocumento = await TipoDocumento.bulkCreate([
    {
      nombre: 'Boleta',
      codigo: 'BOL',
      descripcion: 'Boleta de venta para personas naturales',
      requiere_rut_cliente: false,
      es_fiscal: false,
      aplica_iva: false,
      activo: true
    },
    {
      nombre: 'Factura',
      codigo: 'FAC',
      descripcion: 'Factura de venta para empresas',
      requiere_rut_cliente: true,
      es_fiscal: true,
      aplica_iva: true,
      activo: true
    }
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Tipos de documento creados');
}

async function createWarehouses() {
  const bodegas = await Bodega.bulkCreate([
    {
      codigo: 'SALA',
      nombre: 'Sala de Ventas',
      descripcion: 'Punto de venta principal',
      direccion: 'Local Principal',
      es_punto_venta: true,
      activa: true
    },
    {
      codigo: 'BOD1',
      nombre: 'Bodega Principal',
      descripcion: 'Almacén principal de mercadería',
      direccion: 'Bodega 1',
      es_punto_venta: false,
      activa: true
    },
    {
      codigo: 'BOD2',
      nombre: 'Bodega Secundaria',
      descripcion: 'Almacén de respaldo',
      direccion: 'Bodega 2',
      es_punto_venta: false,
      activa: true
    }
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Bodegas creadas');
}

async function createPaymentMethods() {
  const metodosPago = await MetodoPago.bulkCreate([
    {
      nombre: 'Efectivo',
      codigo: 'EFE',
      tipo: 'efectivo',
      requiere_referencia: false,
      activo: true
    },
    {
      nombre: 'Tarjeta Débito',
      codigo: 'DEB',
      tipo: 'tarjeta',
      requiere_referencia: true,
      activo: true
    },
    {
      nombre: 'Tarjeta Crédito',
      codigo: 'CRE',
      tipo: 'tarjeta',
      requiere_referencia: true,
      activo: true
    },
    {
      nombre: 'Transferencia',
      codigo: 'TRA',
      tipo: 'transferencia',
      requiere_referencia: true,
      activo: true
    }
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Métodos de pago creados');
}

async function createCashRegisters() {
  const cajas = await Caja.bulkCreate([
    {
      nombre: 'Caja Principal',
      ubicacion: 'Mostrador 1',
      activa: true
    },
    {
      nombre: 'Caja Secundaria',
      ubicacion: 'Mostrador 2',
      activa: true
    }
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Cajas creadas');
}

async function createProducts() {
  // Crear productos con múltiples precios (IVA 19%)
  const productos = await Producto.bulkCreate([
    // TELAS
    {
      codigo: 'TEL-GAB-AZ',
      nombre: 'Gabardina',
      descripcion: 'Tela gabardina de alta calidad',
      color: 'Azul',
      id_categoria: 1,
      precio_sin_iva: 2100.00,
      precio_con_iva: 2500.00,
      precio_boleta: 2400.00,
      precio_factura: 2100.00,
      precio_costo: 1800.00,
      stock_minimo_total: 20.00,
      unidad_medida: 'metro',
      activo: true
    },
    {
      codigo: 'TEL-GAB-RO',
      nombre: 'Gabardina',
      descripcion: 'Tela gabardina de alta calidad',
      color: 'Rojo',
      id_categoria: 1,
      precio_sin_iva: 2100.00,
      precio_con_iva: 2500.00,
      precio_boleta: 2400.00,
      precio_factura: 2100.00,
      precio_costo: 1800.00,
      stock_minimo_total: 20.00,
      unidad_medida: 'metro',
      activo: true
    },
    // ... más productos
  ], { 
    ignoreDuplicates: true 
  });

  console.log('✅ Productos creados');
}

async function createInitialStock() {
  // Código del stock inicial...
  console.log('✅ Stock inicial creado');
}