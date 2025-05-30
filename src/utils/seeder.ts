// src/utils/seeder.ts - VERSIÓN CORREGIDA CON DATOS DE EJEMPLO
import { 
  Rol, 
  Usuario, 
  Categoria, 
  Producto,
  VarianteProducto,
  ModalidadProducto,
  TipoDocumento,
  Bodega,
  StockPorBodega,
  MetodoPago,
  Caja 
} from '../models';

export async function seedDatabase() {
  try {
    console.log('🌱 Iniciando siembra de datos corregida...');

    await createRoles();
    await createUsers();
    await createCategories();
    await createDocumentTypes();
    await createWarehouses();
    await createPaymentMethods();
    await createCashRegisters();
    await createProductsWithVariantsAndModalities(); // ✅ CORREGIDO
    await createInitialStock();

    console.log('🌱 ¡Siembra de datos completada exitosamente!');
    console.log('');
    console.log('📝 Usuarios creados:');
    console.log('   👤 admin / admin123 (Administrador)');
    console.log('   👤 cajero1 / cajero123 (Cajero)');
    console.log('   👤 vendedor1 / vendedor123 (Vendedor)');
    console.log('');
    console.log('📦 Productos de ejemplo creados con variantes y modalidades');

  } catch (error) {
    console.error('❌ Error en la siembra de datos:', error);
    throw error;
  }
}

// ✅ FUNCIÓN CORREGIDA PARA CREAR PRODUCTOS COMPLETOS
async function createProductsWithVariantsAndModalities() {
  try {
    console.log('📦 Creando productos con variantes y modalidades...');

    // ========================================
    // PRODUCTO 1: LINO GUCCI
    // ========================================
    const [productoLinoGucci] = await Producto.findOrCreate({
      where: { codigo: 'LIN-GUCCI-001' },
      defaults: {
        codigo: 'LIN-GUCCI-001',
        nombre: 'GUCCI',
        descripcion: 'Línea GUCCI de telas de lino premium',
        id_categoria: 1, // TELAS
        tipo: 'LINO',
        unidad_medida: 'metro',
        stock_minimo_total: 50,
        activo: true
      }
    });

    // MODALIDADES para LINO GUCCI
    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoLinoGucci.id_producto, nombre: 'METRO' },
      defaults: {
        id_producto: productoLinoGucci.id_producto,
        nombre: 'METRO',
        descripcion: 'Venta al corte por metro',
        cantidad_base: 1,
        es_cantidad_variable: true,
        minimo_cantidad: 0.1,
        precio_costo: 2500,
        precio_neto: 3800,
        precio_neto_factura: 3193,
        activa: true
      }
    });

    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoLinoGucci.id_producto, nombre: 'ROLLO' },
      defaults: {
        id_producto: productoLinoGucci.id_producto,
        nombre: 'ROLLO',
        descripcion: 'Rollo completo de 30 metros',
        cantidad_base: 30,
        es_cantidad_variable: false,
        minimo_cantidad: 30,
        precio_costo: 2200,
        precio_neto: 3500,
        precio_neto_factura: 2941,
        activa: true
      }
    });

    // VARIANTES para LINO GUCCI
    const coloresLino = ['Blanco', 'Negro', 'Azul', 'Rojo', 'Verde'];
    for (const color of coloresLino) {
      const [variante] = await VarianteProducto.findOrCreate({
        where: { 
          id_producto: productoLinoGucci.id_producto,
          color: color 
        },
        defaults: {
          id_producto: productoLinoGucci.id_producto,
          sku: `LIN-GUCCI-${color.substring(0, 3).toUpperCase()}`,
          color: color,
          descripcion: `Lino Gucci color ${color}`,
          stock_minimo: 10,
          activo: true
        }
      });
    }

    // ========================================
    // PRODUCTO 2: LINO VERSACE
    // ========================================
    const [productoLinoVersace] = await Producto.findOrCreate({
      where: { codigo: 'LIN-VERSACE-001' },
      defaults: {
        codigo: 'LIN-VERSACE-001',
        nombre: 'VERSACE',
        descripcion: 'Línea VERSACE de telas de lino',
        id_categoria: 1, // TELAS
        tipo: 'LINO',
        unidad_medida: 'metro',
        stock_minimo_total: 40,
        activo: true
      }
    });

    // MODALIDADES para LINO VERSACE
    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoLinoVersace.id_producto, nombre: 'METRO' },
      defaults: {
        id_producto: productoLinoVersace.id_producto,
        nombre: 'METRO',
        descripcion: 'Venta al corte por metro',
        cantidad_base: 1,
        es_cantidad_variable: true,
        minimo_cantidad: 0.1,
        precio_costo: 2300,
        precio_neto: 3500,
        precio_neto_factura: 2941,
        activa: true
      }
    });

    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoLinoVersace.id_producto, nombre: 'ROLLO' },
      defaults: {
        id_producto: productoLinoVersace.id_producto,
        nombre: 'ROLLO',
        descripcion: 'Rollo completo de 25 metros',
        cantidad_base: 25,
        es_cantidad_variable: false,
        minimo_cantidad: 25,
        precio_costo: 2100,
        precio_neto: 3200,
        precio_neto_factura: 2689,
        activa: true
      }
    });

    // VARIANTES para LINO VERSACE
    const coloresVersace = ['Blanco', 'Negro', 'Dorado'];
    for (const color of coloresVersace) {
      await VarianteProducto.findOrCreate({
        where: { 
          id_producto: productoLinoVersace.id_producto,
          color: color 
        },
        defaults: {
          id_producto: productoLinoVersace.id_producto,
          sku: `LIN-VERSACE-${color.substring(0, 3).toUpperCase()}`,
          color: color,
          descripcion: `Lino Versace color ${color}`,
          stock_minimo: 8,
          activo: true
        }
      });
    }

    // ========================================
    // PRODUCTO 3: CORCHETES
    // ========================================
    const [productoCorchetes] = await Producto.findOrCreate({
      where: { codigo: 'COR-001' },
      defaults: {
        codigo: 'COR-001',
        nombre: 'CORCHETES',
        descripcion: 'Corchetes metálicos en diferentes medidas',
        id_categoria: 2, // ACCESORIOS
        tipo: null,
        unidad_medida: 'unidad',
        stock_minimo_total: 100,
        activo: true
      }
    });

    // MODALIDADES para CORCHETES
    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoCorchetes.id_producto, nombre: 'UNIDAD' },
      defaults: {
        id_producto: productoCorchetes.id_producto,
        nombre: 'UNIDAD',
        descripcion: 'Corchete individual',
        cantidad_base: 1,
        es_cantidad_variable: false,
        minimo_cantidad: 1,
        precio_costo: 80,
        precio_neto: 150,
        precio_neto_factura: 126,
        activa: true
      }
    });

    await ModalidadProducto.findOrCreate({
      where: { id_producto: productoCorchetes.id_producto, nombre: 'EMBALAJE' },
      defaults: {
        id_producto: productoCorchetes.id_producto,
        nombre: 'EMBALAJE',
        descripcion: 'Pack de 20 cajas',
        cantidad_base: 10,
        es_cantidad_variable: false,
        minimo_cantidad: 10,
        precio_costo: 75,
        precio_neto: 140,
        precio_neto_factura: 118,
        activa: true
      }
    });

    // VARIANTES para CORCHETES (por medidas)
    const medidasCorchetes = ['71', '12', '1445', '1450', '8012'];
    for (const medida of medidasCorchetes) {
      await VarianteProducto.findOrCreate({
        where: { 
          id_producto: productoCorchetes.id_producto,
          medida: medida 
        },
        defaults: {
          id_producto: productoCorchetes.id_producto,
          sku: `COR-${medida}`,
          medida: medida,
          descripcion: `Corchete medida ${medida}`,
          stock_minimo: 20,
          activo: true
        }
      });
    }

    console.log('✅ Productos con variantes y modalidades creados');

  } catch (error) {
    console.error('❌ Error creando productos:', error);
    throw error;
  }
}

// ✅ FUNCIÓN CORREGIDA PARA CREAR STOCK
async function createInitialStock() {
  try {
    console.log('📊 Creando stock inicial...');

    // Obtener todas las variantes de productos
    const variantes = await VarianteProducto.findAll();
    const bodegas = await Bodega.findAll();

    for (const variante of variantes) {
      for (const bodega of bodegas) {
        // Generar stock aleatorio según el tipo de bodega
        let stockBase = 0;
        
        if (bodega.es_punto_venta) {
          stockBase = Math.floor(Math.random() * 30) + 10; // 10-40 unidades
        } else {
          stockBase = Math.floor(Math.random() * 80) + 20; // 20-100 unidades
        }

        await StockPorBodega.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            id_bodega: bodega.id_bodega
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            id_bodega: bodega.id_bodega,
            cantidad_disponible: stockBase,
            cantidad_reservada: 0,
            stock_minimo: variante.stock_minimo || 5,
            stock_maximo: stockBase * 2
          }
        });
      }
    }

    console.log('✅ Stock inicial creado para todas las variantes');

  } catch (error) {
    console.error('❌ Error creando stock inicial:', error);
    throw error;
  }
}

// Resto de funciones auxiliares (sin cambios)
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

  console.log('✅ Usuarios creados');
}

async function createUserSafely(userData: any) {
  let user = await Usuario.findOne({ where: { usuario: userData.usuario } });

  if (user) {
    const passwordWorks = await user.verificarPassword(userData.password);
    if (!passwordWorks) {
      await user.update({ password_hash: userData.password, activo: true });
    }
  } else {
    await Usuario.createWithPassword(userData);
  }
}

async function createCategories() {
  await Categoria.bulkCreate([
    { nombre: 'TELAS', descripcion: 'Telas de diferentes tipos y materiales', activa: true },
    { nombre: 'ACCESORIOS', descripcion: 'Accesorios de costura y mercería', activa: true },
    { nombre: 'HILOS', descripcion: 'Hilos para costura y bordado', activa: true }
  ], { ignoreDuplicates: true });

  console.log('✅ Categorías creadas');
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