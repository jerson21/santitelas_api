// src/utils/seeder.ts - VERSIÓN COMPLETA CON DATOS BÁSICOS
import { sequelize } from '../config/database';

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
  StockPorBodega,
  ConfiguracionSistema
} from '../models';

export async function seedDatabase() {
  try {
    console.log('🌱 Iniciando seeder...');
    console.log('');

    // CREAR DATOS BÁSICOS PRIMERO
    await createBasicData();

    // Crear usuarios después de los roles
    await createUsers();

    // Datos de ejemplo solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('');
      console.log('🏪 Creando datos de ejemplo para desarrollo...');
      await createProducts();
      await createVariants();
      await createClients();
      await createInitialStock();
      await createModalitiesForExistingVariants();
      await adjustModalitiesPrices();
    }

    console.log('');
    console.log('🌱 ¡Seeder completado!');
    console.log('');
    console.log('📝 Resumen:');
    console.log('   ✅ Datos básicos creados');
    console.log('   👤 Usuarios creados con contraseñas hasheadas');
    if (process.env.NODE_ENV === 'development') {
      console.log('   📦 Productos de ejemplo creados');
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error en seeder:', error);
    throw error;
  }
}

// CREAR TODOS LOS DATOS BÁSICOS
async function createBasicData() {
  console.log('📋 Creando datos básicos...');
  
  // 1. ROLES
  await createRoles();
  
  // 2. CATEGORÍAS
  await createCategories();
  
  // 3. TIPOS DE DOCUMENTO
  await createDocumentTypes();
  
  // 4. BODEGAS
  await createWarehouses();
  
  // 5. MÉTODOS DE PAGO
  await createPaymentMethods();
  
  // 6. CAJAS
  await createCashes();

  await createSystemConfigurations();

  
  console.log('✅ Datos básicos creados');
  console.log('');
}

async function createRoles() {
  console.log('   👥 Creando roles...');
  
  const roles = [
    {
      id_rol: 1,
      nombre: 'Administrador',  // Cambiado de nombre_rol a nombre
      descripcion: 'Acceso total al sistema'
    },
    {
      id_rol: 2,
      nombre: 'Cajero',  // Cambiado de nombre_rol a nombre
      descripcion: 'Gestión de caja y ventas'
    },
   
    {
      id_rol: 3,
      nombre: 'Vendedor',  // Cambiado de nombre_rol a nombre
      descripcion: 'Gestión de ventas'
    },
    {
      id_rol: 4,
      nombre: 'Bodeguero',  // Cambiado de nombre_rol a nombre
      descripcion: 'Gestión de inventario'
    }
  ];

  for (const rol of roles) {
    await Rol.findOrCreate({
      where: { id_rol: rol.id_rol },
      defaults: rol
    });
  }
  
  console.log('      ✓ Roles creados');
}

async function createCategories() {
  console.log('   📁 Creando categorías...');
  
  const categorias = [
    {
      nombre: 'TELAS',
      descripcion: 'Telas de diferentes tipos y materiales',
      activa: true  // Cambiado de activo a activa
    },
    {
      nombre: 'CORCHETES',
      descripcion: 'Corchete tapiceria',
      activa: true  // Cambiado de activo a activa
    },
    {
      nombre: 'ACCESORIOS',
      descripcion: 'Accesorios varios para costura',
      activa: true  // Cambiado de activo a activa
    },
    {
      nombre: 'HILOS',
      descripcion: 'Hilos de diferentes tipos',
      activa: true  // Cambiado de activo a activa
    }
  ];

  for (const categoria of categorias) {
    await Categoria.findOrCreate({
      where: { nombre: categoria.nombre },
      defaults: categoria
    });
  }
  
  console.log('      ✓ Categorías creadas');
}

async function createDocumentTypes() {
  console.log('   📄 Creando tipos de documento...');
  
  const tiposDocumento = [
     {
      codigo: 'TICK',
      nombre: 'Ticket',
      requiere_rut_cliente: false,  // Cambiado de requiere_datos_cliente
      activo: true
    },
    {
      codigo: 'BOL',
      nombre: 'Boleta',
      requiere_rut_cliente: false,  // Cambiado de requiere_datos_cliente
      activo: true
    },
    {
      codigo: 'FAC',
      nombre: 'Factura',
      requiere_rut_cliente: true,  // Cambiado de requiere_datos_cliente
      activo: true
    },
    {
      codigo: 'GDE',
      nombre: 'Guía de Despacho',
      requiere_rut_cliente: true,  // Cambiado de requiere_datos_cliente
      activo: true
    },
    {
      codigo: 'COT',
      nombre: 'Cotización',
      requiere_rut_cliente: false,  // Cambiado de requiere_datos_cliente
      activo: true
    }
  ];

  for (const tipo of tiposDocumento) {
    await TipoDocumento.findOrCreate({
      where: { codigo: tipo.codigo },
      defaults: tipo
    });
  }
  
  console.log('      ✓ Tipos de documento creados');
}

async function createWarehouses() {
  console.log('   🏭 Creando bodegas...');
  
  const bodegas = [
    {
      codigo: 'SALA',
      nombre: 'Sala de Ventas',
      direccion: 'Local principal',
      es_punto_venta: true,  // Cambiado de es_principal
      activa: true  // Cambiado de activo a activa
    },
    {
      codigo: 'BOD01',
      nombre: 'Bodega Principal',
      direccion: 'Bodega central',
      es_punto_venta: false,  // Cambiado de es_principal
      activa: true  // Cambiado de activo a activa
    },
    {
      codigo: 'BOD02',
      nombre: 'Bodega Secundaria',
      direccion: 'Bodega auxiliar',
      es_punto_venta: false,  // Cambiado de es_principal
      activa: true  // Cambiado de activo a activa
    }
  ];

  for (const bodega of bodegas) {
    await Bodega.findOrCreate({
      where: { codigo: bodega.codigo },
      defaults: bodega
    });
  }
  
  console.log('      ✓ Bodegas creadas');
}

async function createPaymentMethods() {
  console.log('   💳 Creando métodos de pago...');
  
  const metodosPago = [
    {
      codigo: 'EFE',
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      requiere_referencia: false,
      activo: true
    },
    {
      codigo: 'DEB',
      nombre: 'Tarjeta de Débito',
      tipo: 'TARJETA',
      requiere_referencia: true,
      activo: true
    },
    {
      codigo: 'CRE',
      nombre: 'Tarjeta de Crédito',
      tipo: 'TARJETA',
      requiere_referencia: true,
      activo: true
    },
    {
      codigo: 'TRA',
      nombre: 'Transferencia',
      tipo: 'TRANSFERENCIA',
      requiere_referencia: true,
      activo: true
    }
    // Removido el método Cheque ya que no es un tipo válido
  ];

  for (const metodo of metodosPago) {
    await MetodoPago.findOrCreate({
      where: { codigo: metodo.codigo },
      defaults: metodo
    });
  }
  
  console.log('      ✓ Métodos de pago creados');
}

async function createCashes() {
  console.log('   💰 Creando cajas...');
  
  const cajas = [
    {
      nombre: 'Caja Principal',
      ubicacion: 'Área de ventas principal',
      activa: true  // Cambiado de activo a activa
    },
    {
      nombre: 'Caja Secundaria',
      ubicacion: 'Área de ventas secundaria',
      activa: true  // Cambiado de activo a activa
    }
  ];

  for (const caja of cajas) {
    await Caja.findOrCreate({
      where: { nombre: caja.nombre },  // Buscar por nombre, no por código
      defaults: caja
    });
  }
  
  console.log('      ✓ Cajas creadas');
}

// CREAR USUARIOS
async function createUsers() {
  console.log('👤 Creando usuarios con contraseñas hasheadas...');
  
  const usersData = [
    {
      usuario: 'admin',
      password: 'admin123',
      nombre_completo: 'Administrador del Sistema',
      email: 'admin@santitelas.cl',
      id_rol: 1,
      activo: true
    },
    {
      usuario: 'cajero1',
      password: 'cajero123',
      nombre_completo: 'Cajero',
      email: 'maria@santitelas.cl',
      id_rol: 2,
      activo: true
    },
    {
      usuario: 'vendedor1',
      password: 'vendedor123',
      nombre_completo: 'Vendedor',
      email: 'juan@santitelas.cl',
      id_rol: 3,
      activo: true
    },
    {
      usuario: 'bodeguero1',
      password: 'bodega123',
      nombre_completo: 'Bodega',
      email: 'carlos@santitelas.cl',
      id_rol: 4,
      activo: true
    }
  ];

  for (const userData of usersData) {
    await createUserSafely(userData);
  }

  console.log('');
  console.log('✅ Usuarios creados exitosamente');
  console.log('');
  console.log('🔐 CREDENCIALES DE ACCESO:');
  console.log('   ┌─────────────┬──────────────┐');
  console.log('   │ Usuario     │ Contraseña   │');
  console.log('   ├─────────────┼──────────────┤');
  console.log('   │ admin       │ admin123     │');
  console.log('   │ cajero1     │ cajero123    │');
  console.log('   │ vendedor1   │ vendedor123  │');
  console.log('   │ bodeguero1  │ bodega123    │');
  console.log('   └─────────────┴──────────────┘');
}

async function createUserSafely(userData: any) {
  try {
    const existingUser = await Usuario.findOne({ 
      where: { usuario: userData.usuario } 
    });

    if (existingUser) {
      console.log(`   ℹ️  Usuario ${userData.usuario} ya existe, verificando...`);
      
      const passwordValid = await existingUser.verificarPassword(userData.password);
      
      if (!passwordValid) {
        console.log(`   🔄 Actualizando contraseña para ${userData.usuario}...`);
        existingUser.password_hash = userData.password;
        await existingUser.save();
        console.log(`   ✅ Contraseña actualizada para ${userData.usuario}`);
      } else {
        console.log(`   ✅ ${userData.usuario} - contraseña correcta`);
      }
      
      if (!existingUser.activo) {
        existingUser.activo = true;
        await existingUser.save();
      }
    } else {
      console.log(`   🆕 Creando usuario ${userData.usuario}...`);
      
      await Usuario.create({
        usuario: userData.usuario,
        password_hash: userData.password, // El hook lo hasheará
        nombre_completo: userData.nombre_completo,
        email: userData.email,
        id_rol: userData.id_rol,
        activo: true
      });
      
      console.log(`   ✅ Usuario ${userData.usuario} creado`);
    }
  } catch (error) {
    console.error(`   ❌ Error con usuario ${userData.usuario}:`, error);
    throw error;
  }
}

// ===== DATOS DE EJEMPLO PARA DESARROLLO =====

async function createProducts() {
  // Verificar si ya existen categorías
  const telasCategory = await Categoria.findOne({ where: { nombre: 'TELAS' } });
  const corchetesCategory = await Categoria.findOne({ where: { nombre: 'CORCHETES' } });
  
  if (!telasCategory || !corchetesCategory) {
    console.log('⚠️  Categorías no encontradas, omitiendo productos');
    return;
  }

  const productos = [
    {
      codigo: 'LIN-GUCCI-001',
      nombre: 'GUCCI',
      descripcion: 'Línea GUCCI de telas de lino premium',
      id_categoria: telasCategory.id_categoria,
      tipo: 'LINO',
      unidad_medida: 'metro',
      precio_costo_base: 2500,
      precio_neto_base: 3800,
      precio_neto_factura_base: 3193,
      activo: true
    },
    {
      codigo: 'LIN-GABANNA-001',
      nombre: 'Gabanna',
      descripcion: 'Línea Gabanna de telas de lino',
      id_categoria: telasCategory.id_categoria,
      tipo: 'LINO',
      unidad_medida: 'metro',
      precio_costo_base: 2300,
      precio_neto_base: 3500,
      precio_neto_factura_base: 2941,
      activo: true
    },
    {
      codigo: 'FEL-SANTI-001',
      nombre: 'SANTI PREMIUM',
      descripcion: 'Línea premium de felpa suave',
      id_categoria: telasCategory.id_categoria,
      tipo: 'FELPA',
      unidad_medida: 'metro',
      precio_costo_base: 1800,
      precio_neto_base: 2500,
      precio_neto_factura_base: 2101,
      activo: true
    },
    {
      codigo: 'COR-MEDIDAS-001',
      nombre: 'Corchetes',
      descripcion: 'Corchetes metálicos de diferentes medidas',
      id_categoria: corchetesCategory.id_categoria,
      tipo: 'CORCHETES',
      unidad_medida: 'unidad',
      precio_costo_base: 0,
      precio_neto_base: 0,
      precio_neto_factura_base: 0,
      activo: true
    }
  ];

  for (const prod of productos) {
    await Producto.findOrCreate({
      where: { codigo: prod.codigo },
      defaults: prod
    });
  }

  console.log('✅ Productos de ejemplo creados');
}

async function createVariants() {
  // Obtener productos creados
  const gucci = await Producto.findOne({ where: { codigo: 'LIN-GUCCI-001' } });
  const gabanna = await Producto.findOne({ where: { codigo: 'LIN-GABANNA-001' } });
  const felpa = await Producto.findOne({ where: { codigo: 'FEL-SANTI-001' } });
  const corchetes = await Producto.findOne({ where: { codigo: 'COR-MEDIDAS-001' } });

  if (!gucci || !gabanna || !felpa || !corchetes) {
    console.log('⚠️  Productos no encontrados, omitiendo variantes');
    return;
  }

  const variantes = [
    // GUCCI
    { id_producto: gucci.id_producto, sku: 'LIN-GUCCI-CRU', color: 'Crudo', descripcion: 'Lino Gucci color Blanco' },
    { id_producto: gucci.id_producto, sku: 'LIN-GUCCI-NEG', color: 'Negro', descripcion: 'Lino Gucci color Negro' },
    { id_producto: gucci.id_producto, sku: 'LIN-GUCCI-AZU', color: 'Azul', descripcion: 'Lino Gucci color Azul' },
    { id_producto: gucci.id_producto, sku: 'LIN-GUCCI-ROJ', color: 'Rojo', descripcion: 'Lino Gucci color Rojo' },
    { id_producto: gucci.id_producto, sku: 'LIN-GUCCI-VER', color: 'Verde', descripcion: 'Lino Gucci color Verde' },

    // GABANNA
    { id_producto: gabanna.id_producto, sku: 'LIN-GABANNA-CRU', color: 'Crudo', descripcion: 'Lino gabanna color Blanco' },
    { id_producto: gabanna.id_producto, sku: 'LIN-GABANNA-NEG', color: 'Negro', descripcion: 'Lino gabanna color Negro' },
    { id_producto: gabanna.id_producto, sku: 'LIN-GABANNA-GM', color: 'Gris medio', descripcion: 'Lino gabanna color Dorado' },
    { id_producto: gabanna.id_producto, sku: 'LIN-GABANNA-BEIG', color: 'Beige', descripcion: 'Lino gabanna color Beige' },

    // FELPA
    { id_producto: felpa.id_producto, sku: 'FEL-SANTI-GRI', color: 'Gris', descripcion: 'Felpa santi color Gris' },
    { id_producto: felpa.id_producto, sku: 'FEL-SANTI-AZU', color: 'Azul', descripcion: 'Felpa santi color Azul' },

    // CORCHETES
    { id_producto: corchetes.id_producto, sku: 'COR-7112', medida: '7112', descripcion: 'Corchete medida 71' },
        { id_producto: corchetes.id_producto, sku: 'COR-8012', medida: '8012', descripcion: 'Corchete medida 8012' },
    { id_producto: corchetes.id_producto, sku: 'COR-1445', medida: '1445', descripcion: 'Corchete medida 1445' },
    { id_producto: corchetes.id_producto, sku: 'COR-1450', medida: '1450', descripcion: 'Corchete medida 1450' }
  ];

  for (const variante of variantes) {
    await VarianteProducto.findOrCreate({
      where: { sku: variante.sku },
      defaults: { ...variante, activo: true }
    });
  }

  console.log('✅ Variantes de productos creadas');
}

async function createClients() {
  // Crear algunos clientes de ejemplo
  const clientes = [
    {
      rut: '12345678-9',
      tipo_cliente: 'empresa',
      nombre: 'Textiles del Sur Ltda.',
      razon_social: 'Textiles del Sur Limitada',
      giro: 'Venta de textiles',
      direccion: 'Av. Principal 123',
      comuna: 'Santiago',
      ciudad: 'Santiago',
      telefono: '+56912345678',
      email: 'contacto@textilesdelsur.cl',
      activo: true,
      datos_completos: true
    },
    {
      rut: '98765432-1',
      tipo_cliente: 'persona',
      nombre: 'María Rodríguez',
      telefono: '+56987654321',
      email: 'maria.rodriguez@email.cl',
      activo: true,
      datos_completos: false
    },
    {
      rut: '11222333-4',
      tipo_cliente: 'empresa',
      nombre: 'Confecciones ABC',
      razon_social: 'Confecciones ABC SpA',
      giro: 'Confección de prendas',
      direccion: 'Calle Los Aromos 456',
      comuna: 'Providencia',
      ciudad: 'Santiago',
      activo: true,
      datos_completos: true
    }
  ];

  for (const cliente of clientes) {
    await Cliente.findOrCreate({
      where: { rut: cliente.rut },
      defaults: cliente
    });
  }

  console.log('✅ Clientes de ejemplo creados');
}

async function createInitialStock() {
  // Obtener bodega sala de ventas
  const bodegaSala = await Bodega.findOne({ where: { codigo: 'SALA' } });
  if (!bodegaSala) {
    console.log('⚠️  Bodega SALA no encontrada, omitiendo stock');
    return;
  }

  // Obtener algunas variantes para darles stock
  const variantesGucci = await VarianteProducto.findAll({
    where: { sku: ['LIN-GUCCI-CRU', 'LIN-GUCCI-NEG', 'LIN-GUCCI-AZU'] }
  });

  const variantesVersace = await VarianteProducto.findAll({
    where: { sku: ['LIN-GABANNA-CRU', 'LIN-GABANNA-NEG'] }
  });

  const variantesFelpa = await VarianteProducto.findAll({
    where: { sku: ['FEL-SANTI-GRI', 'FEL-PREMIUM-AZU'] }
  });

  const variantesCorchetes = await VarianteProducto.findAll({
    where: { sku: ['COR-7112', 'COR-8012', 'COR-1445'] }
  });

  // Stock para Gucci
  for (const variante of variantesGucci) {
    await StockPorBodega.findOrCreate({
      where: {
        id_variante_producto: variante.id_variante_producto,
        id_bodega: bodegaSala.id_bodega
      },
      defaults: {
        cantidad_disponible: Math.floor(Math.random() * 200) + 50,
        cantidad_reservada: 0,
        stock_minimo: 10,
        stock_maximo: 300
      }
    });
  }

  // Stock para Versace
  for (const variante of variantesVersace) {
    await StockPorBodega.findOrCreate({
      where: {
        id_variante_producto: variante.id_variante_producto,
        id_bodega: bodegaSala.id_bodega
      },
      defaults: {
        cantidad_disponible: Math.floor(Math.random() * 150) + 30,
        cantidad_reservada: 0,
        stock_minimo: 5,
        stock_maximo: 200
      }
    });
  }

  // Stock para Felpa
  for (const variante of variantesFelpa) {
    await StockPorBodega.findOrCreate({
      where: {
        id_variante_producto: variante.id_variante_producto,
        id_bodega: bodegaSala.id_bodega
      },
      defaults: {
        cantidad_disponible: Math.floor(Math.random() * 100) + 20,
        cantidad_reservada: 0,
        stock_minimo: 10,
        stock_maximo: 150
      }
    });
  }

  // Stock para Corchetes (cantidades más altas)
  for (const variante of variantesCorchetes) {
    await StockPorBodega.findOrCreate({
      where: {
        id_variante_producto: variante.id_variante_producto,
        id_bodega: bodegaSala.id_bodega
      },
      defaults: {
        cantidad_disponible: Math.floor(Math.random() * 5000) + 1000,
        cantidad_reservada: 0,
        stock_minimo: 100,
        stock_maximo: 10000
      }
    });
  }

  console.log('✅ Stock inicial creado');
}


async function createSystemConfigurations() {
  console.log('   ⚙️ Creando configuraciones por defecto...');

  const configs = [
    { clave: 'stock.permite_venta_sin_stock', valor: 'false', tipo: 'boolean', descripcion: 'Permitir ventas cuando no hay stock disponible', categoria: 'stock' },
    { clave: 'stock.auto_asignar_bodega', valor: 'true', tipo: 'boolean', descripcion: 'Asignar automáticamente la bodega para ventas', categoria: 'stock' },
    { clave: 'stock.prioridad_bodega', valor: 'mayor_stock', tipo: 'string', descripcion: 'Criterio para asignar bodega: mayor_stock, mas_cercana, fifo', categoria: 'stock' },
    { clave: 'stock.reserva_temporal_minutos', valor: '30', tipo: 'number', descripcion: 'Tiempo en minutos para reservas temporales en vales', categoria: 'stock' },
    { clave: 'venta.validar_stock_en_vale', valor: 'true', tipo: 'boolean', descripcion: 'Validar disponibilidad de stock al crear vales', categoria: 'venta' },
    { clave: 'venta.crear_reserva_temporal', valor: 'true', tipo: 'boolean', descripcion: 'Crear reserva temporal al generar vale', categoria: 'venta' },
    { clave: 'venta.timeout_vale_minutos', valor: '60', tipo: 'number', descripcion: 'Tiempo máximo para procesar un vale antes de liberar reserva', categoria: 'venta' },
    { clave: 'ui.modo_stock_default', valor: 'unificado', tipo: 'string', descripcion: 'Vista por defecto: unificado, por_bodega, ambos', categoria: 'ui' }
  ];

  for (const cfg of configs) {
    await ConfiguracionSistema.findOrCreate({
      where: { clave: cfg.clave },
      defaults: cfg
    });
  }

  console.log('      ✓ Configuraciones creadas');
}

// REEMPLAZAR ESTAS FUNCIONES EN TU SEEDER
// REEMPLAZAR ESTAS FUNCIONES EN TU SEEDER
// NO NECESITAS IMPORTAR sequelize con esta versión

async function createModalitiesForExistingVariants() {
  console.log('🏷️  Creando modalidades para variantes...');
  
  try {
    // Obtener todas las variantes
    const variantes = await VarianteProducto.findAll();

    if (variantes.length === 0) {
      console.log('⚠️  No se encontraron variantes, omitiendo modalidades');
      return;
    }

    console.log(`   📋 Procesando ${variantes.length} variantes...`);

    let modalidadesCreadas = 0;

    for (const variante of variantes) {
      // Obtener el producto de la variante
      const producto = await Producto.findByPk(variante.id_producto);
      
      if (!producto) {
        console.log(`   ⚠️  Producto no encontrado para variante ${variante.sku}`);
        continue;
      }
      
      console.log(`   🔄 Creando modalidades para: ${variante.sku} (${producto.unidad_medida})`);
      
      if (producto.unidad_medida === 'metro') {
        // MODALIDADES PARA TELAS (metro)
        
        // 1. METRO - Venta al corte
        const [modalidadMetro, creadoMetro] = await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'METRO'
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'METRO',
            descripcion: 'Venta al corte por metro',
            cantidad_base: 1,
            es_cantidad_variable: true,
            minimo_cantidad: 0.1,
            precio_costo: producto.precio_costo_base || 0,
            precio_neto: producto.precio_neto_base || 0,
            precio_neto_factura: producto.precio_neto_factura_base || 0,
            activo: true
          }
        });

        // 2. ROLLO - 25 metros con descuento
        const precioRolloCosto = Math.round((producto.precio_costo_base || 0) * 25 * 0.9);
        const precioRolloNeto = Math.round((producto.precio_neto_base || 0) * 25 * 0.9);
        const precioRolloFactura = Math.round((producto.precio_neto_factura_base || 0) * 25 * 0.9);

        const [modalidadRollo, creadoRollo] = await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'ROLLO'
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'ROLLO',
            descripcion: 'Rollo completo de 25 metros',
            cantidad_base: 25,
            es_cantidad_variable: false,
            minimo_cantidad: 25,
            precio_costo: precioRolloCosto,
            precio_neto: precioRolloNeto,
            precio_neto_factura: precioRolloFactura,
            activo: true
          }
        });

        if (creadoMetro) modalidadesCreadas++;
        if (creadoRollo) modalidadesCreadas++;
        
        console.log(`      ✓ Metro ($${producto.precio_neto_base}) y Rollo ($${precioRolloNeto})`);

      } else if (producto.unidad_medida === 'unidad') {
        // MODALIDADES PARA PRODUCTOS UNITARIOS (corchetes, accesorios, etc.)
        
        // Para corchetes que no tienen precio, asignar precios base
        const precioBase = producto.precio_neto_base || 100;
        const precioCosto = producto.precio_costo_base || 50;
        const precioFactura = producto.precio_neto_factura_base || 84;
        
        // 1. UNIDAD - Venta individual
        const [modalidadUnidad, creadoUnidad] = await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'UNIDAD'
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'UNIDAD',
            descripcion: 'Venta por unidad individual',
            cantidad_base: 1,
            es_cantidad_variable: false,
            minimo_cantidad: 1,
            precio_costo: precioCosto,
            precio_neto: precioBase,
            precio_neto_factura: precioFactura,
            activo: true
          }
        });

        // 2. PAQUETE - 10 unidades con descuento
        const precioPaqueteCosto = Math.round(precioCosto * 10 * 0.85);
        const precioPaqueteNeto = Math.round(precioBase * 10 * 0.85);
        const precioPaqueteFactura = Math.round(precioFactura * 10 * 0.85);

        const [modalidadPaquete, creadoPaquete] = await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'PAQUETE'
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'PAQUETE',
            descripcion: 'Paquete de 10 unidades',
            cantidad_base: 10,
            es_cantidad_variable: false,
            minimo_cantidad: 10,
            precio_costo: precioPaqueteCosto,
            precio_neto: precioPaqueteNeto,
            precio_neto_factura: precioPaqueteFactura,
            activo: true
          }
        });

        if (creadoUnidad) modalidadesCreadas++;
        if (creadoPaquete) modalidadesCreadas++;
        
        console.log(`      ✓ Unidad ($${precioBase}) y Paquete ($${precioPaqueteNeto})`);

      } else {
        // MODALIDAD POR DEFECTO para otros tipos
        const [modalidadDefault, creadoDefault] = await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'UNIDAD'
          },
          defaults: {
            id_variante_producto: variante.id_variante_producto,
            nombre: 'UNIDAD',
            descripcion: 'Venta estándar',
            cantidad_base: 1,
            es_cantidad_variable: false,
            minimo_cantidad: 1,
            precio_costo: producto.precio_costo_base || 0,
            precio_neto: producto.precio_neto_base || 0,
            precio_neto_factura: producto.precio_neto_factura_base || 0,
            activo: true
          }
        });

        if (creadoDefault) modalidadesCreadas++;
        console.log(`      ✓ Unidad ($${producto.precio_neto_base || 0})`);
      }
    }

    console.log(`   📊 Total modalidades creadas: ${modalidadesCreadas}`);
    console.log('✅ Modalidades creadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando modalidades:', error);
    throw error;
  }
}

async function adjustModalitiesPrices() {
  console.log('💰 Verificando modalidades creadas...');
  
  try {
    // Obtener estadísticas básicas
    const totalModalidades = await ModalidadProducto.count();
    const totalVariantes = await VarianteProducto.count();
    
    console.log(`   📊 Variantes: ${totalVariantes}, Modalidades: ${totalModalidades}`);

    if (totalModalidades === 0) {
      console.log('⚠️  No se encontraron modalidades');
      return;
    }

    // Obtener todas las modalidades una por una para mostrar resumen
    const modalidades = await ModalidadProducto.findAll();
    
    console.log('   📋 Modalidades disponibles:');
    console.log('   ┌─────────────────────────────────────────────────────────┐');
    console.log('   │ SKU              │ Modalidad │ Precio  │ Base    │ Var  │');
    console.log('   ├─────────────────────────────────────────────────────────┤');
    
    const estadisticas = {
      metro: 0,
      rollo: 0,
      unidad: 0,
      paquete: 0
    };

    for (const modalidad of modalidades) {
      // Obtener variante y producto
      const variante = await VarianteProducto.findByPk(modalidad.id_variante_producto);
      if (!variante) continue;
      
      const sku = variante.sku.padEnd(16).substring(0, 16);
      const modalidadName = modalidad.nombre.padEnd(9).substring(0, 9);
      const precio = `$${modalidad.precio_neto}`.padStart(7);
      const base = `${modalidad.cantidad_base}`.padStart(7);
      const variable = modalidad.es_cantidad_variable ? ' Sí' : ' No';
      
      console.log(`   │ ${sku} │ ${modalidadName} │ ${precio} │ ${base} │ ${variable} │`);
      
      // Contar estadísticas
      const nombreLower = modalidad.nombre.toLowerCase();
      if (nombreLower === 'metro') estadisticas.metro++;
      else if (nombreLower === 'rollo') estadisticas.rollo++;
      else if (nombreLower === 'unidad') estadisticas.unidad++;
      else if (nombreLower === 'paquete') estadisticas.paquete++;
    }
    
    console.log('   └─────────────────────────────────────────────────────────┘');
    
    console.log('   📊 Resumen por tipo:');
    if (estadisticas.metro > 0) console.log(`      • METRO: ${estadisticas.metro} modalidades`);
    if (estadisticas.rollo > 0) console.log(`      • ROLLO: ${estadisticas.rollo} modalidades`);
    if (estadisticas.unidad > 0) console.log(`      • UNIDAD: ${estadisticas.unidad} modalidades`);
    if (estadisticas.paquete > 0) console.log(`      • PAQUETE: ${estadisticas.paquete} modalidades`);

    console.log('✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error verificando modalidades:', error);
    throw error;
  }
}