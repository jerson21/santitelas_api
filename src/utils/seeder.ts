// src/utils/seeder.ts - VERSIÓN COMPLETA CON USUARIOS, CONFIGURACIÓN BÁSICA Y DATOS DEL SQL

import {
  Rol,
  Usuario,
  Categoria,
  TipoDocumento,
  Bodega,
  MetodoPago,
  Caja,
  Producto,
  VarianteProducto,
  ModalidadProducto,
  Cliente,
  StockPorBodega
} from '../models';

export async function seedDatabase() {
  try {
    console.log('🌱 Iniciando siembra de datos...');

    await createRoles();
    await createUsers();
    await createCategories();
    await createDocumentTypes();
    await createWarehouses();
    await createPaymentMethods();
    await createCashRegisters();

    // Ahora agregamos los datos adicionales que estaban en tu script SQL:

    await createProducts();
    await createVariants();
    await createClients();
    await createInitialStock();
    await createModalitiesForExistingVariants();
    await adjustModalitiesPrices();

    console.log('');
    console.log('🌱 ¡Siembra de datos completada!');
    console.log('');
    console.log('📝 Resumen:');
    console.log('   👤 Roles, usuarios y configuración básica creados');
    console.log('   📦 Productos, variantes, clientes y stock inicial creados/actualizados');
    console.log('');
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
    // Si no existe, crearlo (asumimos que createWithPassword genera el hash interno)
    await Usuario.createWithPassword(userData);
    console.log(`🆕 Usuario ${userData.usuario} creado`);
  }
}

async function createCategories() {
  await Categoria.bulkCreate(
    [
      { nombre: 'TELAS', descripcion: 'Telas de diferentes tipos y materiales', activa: true },
      { nombre: 'ACCESORIOS', descripcion: 'Accesorios de costura y mercería', activa: true },
      { nombre: 'HILOS', descripcion: 'Hilos para costura y bordado', activa: true },
      { nombre: 'BOTONES', descripcion: 'Botones de diferentes tipos y tamaños', activa: true },
      { nombre: 'PATAS', descripcion: 'Patas y accesorios de costura', activa: true },
      { nombre: 'CORCHETES', descripcion: 'Corchetes metálicos de diferentes medidas', activa: true }
    ],
    {
      ignoreDuplicates: true,
      updateOnDuplicate: ['descripcion', 'activa']
    }
  );

  console.log('✅ Categorías básicas creadas/actualizadas');
}

async function createDocumentTypes() {
  await TipoDocumento.bulkCreate(
    [
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
        es_fiscal: true,
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
    ],
    { ignoreDuplicates: true }
  );

  console.log('✅ Tipos de documento creados');
}

async function createWarehouses() {
  await Bodega.bulkCreate(
    [
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
    ],
    { ignoreDuplicates: true }
  );

  console.log('✅ Bodegas creadas');
}

async function createPaymentMethods() {
  await MetodoPago.bulkCreate(
    [
      { nombre: 'Efectivo', codigo: 'EFE', tipo: 'efectivo', requiere_referencia: false, activo: true },
      { nombre: 'Tarjeta Débito', codigo: 'DEB', tipo: 'tarjeta', requiere_referencia: true, activo: true },
      { nombre: 'Tarjeta Crédito', codigo: 'CRE', tipo: 'tarjeta', requiere_referencia: true, activo: true },
      { nombre: 'Transferencia', codigo: 'TRA', tipo: 'transferencia', requiere_referencia: true, activo: true }
    ],
    { ignoreDuplicates: true }
  );

  console.log('✅ Métodos de pago creados');
}

async function createCashRegisters() {
  await Caja.bulkCreate(
    [
      { nombre: 'Caja Principal', ubicacion: 'Mostrador 1', activa: true },
      { nombre: 'Caja Secundaria', ubicacion: 'Mostrador 2', activa: true }
    ],
    { ignoreDuplicates: true }
  );

  console.log('✅ Cajas creadas');
}

// ===== DATOS ADICIONALES DEL SCRIPT SQL =====

async function createProducts() {
  // Bulk create de productos base según tu SQL
  await Producto.bulkCreate(
    [
      {
        codigo: 'LIN-GUCCI-001',
        nombre: 'GUCCI',
        descripcion: 'Línea GUCCI de telas de lino premium',
        id_categoria: 1, // TELAS
        tipo: 'LINO',
        unidad_medida: 'metro',
        precio_costo_base: 2500,
        precio_neto_base: 3800,
        precio_neto_factura_base: 3193,
        activo: true
      },
      {
        codigo: 'LIN-VERSACE-001',
        nombre: 'VERSACE',
        descripcion: 'Línea VERSACE de telas de lino',
        id_categoria: 1,
        tipo: 'LINO',
        unidad_medida: 'metro',
        precio_costo_base: 2300,
        precio_neto_base: 3500,
        precio_neto_factura_base: 2941,
        activo: true
      },
      {
        codigo: 'FEL-PREMIUM-001',
        nombre: 'PREMIUM',
        descripcion: 'Línea premium de felpa suave',
        id_categoria: 1,
        tipo: 'FELPA',
        unidad_medida: 'metro',
        precio_costo_base: 1800,
        precio_neto_base: 2500,
        precio_neto_factura_base: 2101,
        activo: true
      },
      {
        codigo: 'COR-MEDIDAS-001',
        nombre: 'Corchetes Varios',
        descripcion: 'Corchetes metálicos de diferentes medidas',
        id_categoria: 4, // CORCHETES
        tipo: 'CORCHETES',
        unidad_medida: 'unidad',
        precio_costo_base: 100,
        precio_neto_base: 150,
        precio_neto_factura_base: 126,
        activo: true
      },
      {
        codigo: 'ACC-BOT-001',
        nombre: 'Botones Clásicos',
        descripcion: 'Botones básicos para confección',
        id_categoria: 2, // ACCESORIOS
        tipo: null,
        unidad_medida: 'unidad',
        precio_costo_base: 100,
        precio_neto_base: 150,
        precio_neto_factura_base: 126,
        activo: true
      },
      {
        codigo: 'HIL-ALG-001',
        nombre: 'Hilo Algodón',
        descripcion: 'Hilo de algodón para costura',
        id_categoria: 5, // HILOS
        tipo: null,
        unidad_medida: 'unidad',
        precio_costo_base: 300,
        precio_neto_base: 450,
        precio_neto_factura_base: 378,
        activo: true
      },
      {
        codigo: 'PAT-MAD-001',
        nombre: 'Pata Madera',
        descripcion: 'Patas de madera para muebles',
        id_categoria: 3, // PATAS
        tipo: 'MADERA',
        unidad_medida: 'unidad',
        precio_costo_base: 500,
        precio_neto_base: 800,
        precio_neto_factura_base: 672,
        activo: true
      }
    ],
    {
      ignoreDuplicates: true
    }
  );

  console.log('✅ Productos de ejemplo creados');
}

async function createVariants() {
  // Bulk create de variantes según tu SQL (asumiendo correspondencia de id_producto a lo insertado arriba)
  await VarianteProducto.bulkCreate(
    [
      // GUCCI
      { id_producto: 1, sku: 'LIN-GUCCI-BLA', color: 'Blanco', medida: null, descripcion: 'Lino Gucci color Blanco', activo: true },
      { id_producto: 1, sku: 'LIN-GUCCI-NEG', color: 'Negro', medida: null, descripcion: 'Lino Gucci color Negro', activo: true },
      { id_producto: 1, sku: 'LIN-GUCCI-AZU', color: 'Azul', medida: null, descripcion: 'Lino Gucci color Azul', activo: true },
      { id_producto: 1, sku: 'LIN-GUCCI-ROJ', color: 'Rojo', medida: null, descripcion: 'Lino Gucci color Rojo', activo: true },
      { id_producto: 1, sku: 'LIN-GUCCI-VER', color: 'Verde', medida: null, descripcion: 'Lino Gucci color Verde', activo: true },

      // VERSACE
      { id_producto: 2, sku: 'LIN-VERSACE-BLA', color: 'Blanco', medida: null, descripcion: 'Lino Versace color Blanco', activo: true },
      { id_producto: 2, sku: 'LIN-VERSACE-NEG', color: 'Negro', medida: null, descripcion: 'Lino Versace color Negro', activo: true },
      { id_producto: 2, sku: 'LIN-VERSACE-DOR', color: 'Dorado', medida: null, descripcion: 'Lino Versace color Dorado', activo: true },

      // FELPA PREMIUM  
      { id_producto: 3, sku: 'FEL-PREMIUM-GRI', color: 'Gris', medida: null, descripcion: 'Felpa premium color Gris', activo: true },
      { id_producto: 3, sku: 'FEL-PREMIUM-AZU', color: 'Azul', medida: null, descripcion: 'Felpa premium color Azul', activo: true },

      // CORCHETES - Cada medida
      { id_producto: 4, sku: 'COR-71', color: null, medida: '71', descripcion: 'Corchete medida 71', activo: true },
      { id_producto: 4, sku: 'COR-12', color: null, medida: '12', descripcion: 'Corchete medida 12', activo: true },
      { id_producto: 4, sku: 'COR-1445', color: null, medida: '1445', descripcion: 'Corchete medida 1445', activo: true },
      { id_producto: 4, sku: 'COR-1450', color: null, medida: '1450', descripcion: 'Corchete medida 1450', activo: true },
      { id_producto: 4, sku: 'COR-8012', color: null, medida: '8012', descripcion: 'Corchete medida 8012', activo: true },

      // OTROS PRODUCTOS
      { id_producto: 5, sku: 'ACC-BOT-NE', color: 'Negro', medida: null, descripcion: 'Botones negros clásicos', activo: true },
      { id_producto: 5, sku: 'ACC-BOT-BL', color: 'Blanco', medida: null, descripcion: 'Botones blancos clásicos', activo: true },
      { id_producto: 6, sku: 'HIL-ALG-BL', color: 'Blanco', medida: null, descripcion: 'Hilo algodón blanco', activo: true },
      { id_producto: 6, sku: 'HIL-ALG-NE', color: 'Negro', medida: null, descripcion: 'Hilo algodón negro', activo: true },
      { id_producto: 7, sku: 'PAT-MAD-NAT', color: 'Natural', medida: null, descripcion: 'Pata madera natural', activo: true },
      { id_producto: 7, sku: 'PAT-MAD-TEÑ', color: 'Teñida', medida: null, descripcion: 'Pata madera teñida', activo: true }
    ],
    { ignoreDuplicates: true }
  );

  console.log('✅ Variantes de productos creadas');
}

async function createClients() {
  // Cliente ejemplo
  await Cliente.findOrCreate({
    where: { rut: '12345678-9' },
    defaults: {
      tipo_cliente: 'empresa',
      nombre: 'Cliente por completar datos',
      activo: true,
      datos_completos: false
    }
  });

  console.log('✅ Cliente de ejemplo creado');
}

async function createInitialStock() {
  // Insertar stock inicial para algunas variantes
  const stockData = [
    // Stocks para LINO GUCCI en sala de ventas (id_bodega = 1)
    { id_variante_producto: 1, id_bodega: 1, cantidad_disponible: 150.0, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 2, id_bodega: 1, cantidad_disponible: 120.0, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 3, id_bodega: 1, cantidad_disponible: 80.0, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 4, id_bodega: 1, cantidad_disponible: 200.0, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 5, id_bodega: 1, cantidad_disponible: 90.0, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },

    // Stocks para corchetes (id_variante_producto 11 a 15, id_bodega = 1)
    { id_variante_producto: 11, id_bodega: 1, cantidad_disponible: 500, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 12, id_bodega: 1, cantidad_disponible: 300, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 13, id_bodega: 1, cantidad_disponible: 150, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 14, id_bodega: 1, cantidad_disponible: 200, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 },
    { id_variante_producto: 15, id_bodega: 1, cantidad_disponible: 100, cantidad_reservada: 0, stock_minimo: 0, stock_maximo: 0 }
  ];

  await StockPorBodega.bulkCreate(stockData, { ignoreDuplicates: true });

  console.log('✅ Stock inicial insertado');
}
async function createModalitiesForExistingVariants() {
  // Obtener todas las variantes primero (sin include)
  const variants = await VarianteProducto.findAll();

  const modalidadesToInsert: any[] = [];

  for (const vp of variants) {
    // En lugar de usar `include`, buscamos el producto por su PK
    const prod = await Producto.findByPk(vp.id_producto);
    if (!prod) continue;

    // Extraemos los campos necesarios
    const precioCostoBase = prod.precio_costo_base || 0;
    const precioNetoBase = prod.precio_neto_base || 0;
    const precioNetoFacturaBase = prod.precio_neto_factura_base || 0;
    const unidad = prod.unidad_medida || 'unidad';
    const idVar = vp.id_variante_producto;

    // Verificar si ya existen modalidades para esta variante
    const count = await ModalidadProducto.count({ where: { id_variante_producto: idVar } });
    if (count > 0) continue;

    if (unidad === 'metro') {
      modalidadesToInsert.push(
        {
          id_variante_producto: idVar,
          nombre: 'METRO',
          descripcion: 'Venta al corte por metro',
          cantidad_base: 1,
          es_cantidad_variable: true,
          minimo_cantidad: 0.1,
          precio_costo: precioCostoBase,
          precio_neto: precioNetoBase,
          precio_neto_factura: precioNetoFacturaBase,
          activa: true
        },
        {
          id_variante_producto: idVar,
          nombre: 'ROLLO',
          descripcion: 'Rollo completo',
          cantidad_base: 25,
          es_cantidad_variable: false,
          minimo_cantidad: 25,
          precio_costo: Math.round(precioCostoBase * 0.9),
          precio_neto: Math.round(precioNetoBase * 0.9),
          precio_neto_factura: Math.round(precioNetoFacturaBase * 0.9),
          activa: true
        }
      );
    } else if (unidad === 'unidad') {
      modalidadesToInsert.push(
        {
          id_variante_producto: idVar,
          nombre: 'UNIDAD',
          descripcion: 'Venta por unidad',
          cantidad_base: 1,
          es_cantidad_variable: false,
          minimo_cantidad: 1,
          precio_costo: precioCostoBase,
          precio_neto: precioNetoBase,
          precio_neto_factura: precioNetoFacturaBase,
          activa: true
        },
        {
          id_variante_producto: idVar,
          nombre: 'EMBALAJE',
          descripcion: 'Embalaje completo',
          cantidad_base: 10,
          es_cantidad_variable: false,
          minimo_cantidad: 10,
          precio_costo: Math.round(precioCostoBase * 0.85),
          precio_neto: Math.round(precioNetoBase * 0.85),
          precio_neto_factura: Math.round(precioNetoFacturaBase * 0.85),
          activa: true
        }
      );
    } else {
      // Por defecto: solo UNIDAD
      modalidadesToInsert.push({
        id_variante_producto: idVar,
        nombre: 'UNIDAD',
        descripcion: 'Venta por unidad',
        cantidad_base: 1,
        es_cantidad_variable: false,
        minimo_cantidad: 1,
        precio_costo: precioCostoBase,
        precio_neto: precioNetoBase,
        precio_neto_factura: precioNetoFacturaBase,
        activa: true
      });
    }
  }

  if (modalidadesToInsert.length > 0) {
    await ModalidadProducto.bulkCreate(modalidadesToInsert, { ignoreDuplicates: true });
    console.log('✅ Modalidades automáticas para variantes creadas');
  } else {
    console.log('ℹ️ No se necesitó crear modalidades automáticas (ya existen)');
  }
}


async function adjustModalitiesPrices() {
  // Actualizar precios específicos para corchetes (medidas 71, 12, 1445, 1450, 8012)
  // Según SQL:
  // 71 → costo 85, neto 160, factura 134
  // 12 → costo 90, neto 170, factura 143
  // 1445 → costo 120, neto 220, factura 185
  // 1450 → costo 125, neto 230, factura 193
  // 8012 → costo 140, neto 250, factura 210

  const mapping: Record<string, { costo: number; neto: number; factura: number }> = {
    '71': { costo: 85, neto: 160, factura: 134 },
    '12': { costo: 90, neto: 170, factura: 143 },
    '1445': { costo: 120, neto: 220, factura: 185 },
    '1450': { costo: 125, neto: 230, factura: 193 },
    '8012': { costo: 140, neto: 250, factura: 210 }
  };

  // Encuentra variantes con esas medidas
  const variantesCorchetes = await VarianteProducto.findAll({
    where: { medida: Object.keys(mapping) }
  });

  for (const vp of variantesCorchetes) {
    const medida = vp.medida!;
    const data = mapping[medida];

    // Obtener todas las modalidades de esta variante
    const modalidades = await ModalidadProducto.findAll({
      where: { id_variante_producto: vp.id_variante_producto }
    });

    for (const mp of modalidades) {
      // Actualizamos solo si la modalidad existe (p.ej. UNIDAD, EMBALAJE, etc.)
      await mp.update({
        precio_costo: data.costo,
        precio_neto: data.neto,
        precio_neto_factura: data.factura
      });
    }
  }

  console.log('✅ Precios de modalidades de corchetes ajustados');
}
