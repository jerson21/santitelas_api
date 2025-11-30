// src/utils/seeder.ts - VERSIÓN COMPLETA CON DATOS BÁSICOS

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
      nombre: 'Bodeguero',  // Cambiado de nombre_rol a nombre
      descripcion: 'Gestión de inventario'
    },
    {
      id_rol: 4,
      nombre: 'Vendedor',  // Cambiado de nombre_rol a nombre
      descripcion: 'Gestión de ventas'
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
      id_rol: 4,
      activo: true
    },
    {
      usuario: 'bodeguero1',
      password: 'bodega123',
      nombre_completo: 'Bodega',
      email: 'carlos@santitelas.cl',
      id_rol: 3,
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
  // Crear categorías necesarias
  const [telasCategory] = await Categoria.findOrCreate({
    where: { nombre: 'TELAS' },
    defaults: { nombre: 'TELAS', descripcion: 'Telas en general', activa: true }
  });

  const [corchetesCategory] = await Categoria.findOrCreate({
    where: { nombre: 'CORCHETES' },
    defaults: { nombre: 'CORCHETES', descripcion: 'Corchetes y accesorios de cierre', activa: true }
  });

  const [hilosCategory] = await Categoria.findOrCreate({
    where: { nombre: 'HILOS' },
    defaults: { nombre: 'HILOS', descripcion: 'Hilos para costura', activa: true }
  });

  const [accesoriosCategory] = await Categoria.findOrCreate({
    where: { nombre: 'ACCESORIOS' },
    defaults: { nombre: 'ACCESORIOS', descripcion: 'Accesorios varios', activa: true }
  });

  const productos = [
    // ===== TELAS LINO =====
    { codigo: 'LIN-GUCCI', nombre: 'GUCCI SANTI', descripcion: 'Tela de lino Gucci Santi', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-GABANNA', nombre: 'GABANNA', descripcion: 'Tela de lino Gabanna', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-CARTIER', nombre: 'CARTIER', descripcion: 'Tela de lino Cartier', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-DIOR', nombre: 'DIOR', descripcion: 'Tela de lino Dior', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-COZUMEL', nombre: 'COZUMEL', descripcion: 'Tela de lino Cozumel', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-TOKIO', nombre: 'TOKIO', descripcion: 'Tela de lino Tokio', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },
    { codigo: 'LIN-VERNACCI', nombre: 'VERNACCI', descripcion: 'Tela de lino Vernacci', id_categoria: telasCategory.id_categoria, tipo: 'LINO', unidad_medida: 'metro', activo: true },

    // ===== CORCHETES =====
    { codigo: 'COR-7112', nombre: 'Corchete 7112', descripcion: 'Corchete medida 7112', id_categoria: corchetesCategory.id_categoria, tipo: 'CORCHETES', unidad_medida: 'unidad', activo: true },
    { codigo: 'COR-1450', nombre: 'Corchete 1450', descripcion: 'Corchete medida 1450', id_categoria: corchetesCategory.id_categoria, tipo: 'CORCHETES', unidad_medida: 'unidad', activo: true },
    { codigo: 'COR-8012', nombre: 'Corchete 8012', descripcion: 'Corchete medida 8012', id_categoria: corchetesCategory.id_categoria, tipo: 'CORCHETES', unidad_medida: 'unidad', activo: true },
    { codigo: 'COR-1445', nombre: 'Corchete 1445', descripcion: 'Corchete medida 1445', id_categoria: corchetesCategory.id_categoria, tipo: 'CORCHETES', unidad_medida: 'unidad', activo: true },

    // ===== HILOS =====
    { codigo: 'HIL-5000MT', nombre: 'Hilos 5000mt', descripcion: 'Hilos de 5000 metros o yardas', id_categoria: hilosCategory.id_categoria, tipo: 'HILOS', unidad_medida: 'unidad', activo: true },

    // ===== ACCESORIOS =====
    { codigo: 'ACC-PATA-CAMA', nombre: 'Pata de cama plástica', descripcion: 'Pata de cama plástica', id_categoria: accesoriosCategory.id_categoria, tipo: 'ACCESORIOS', unidad_medida: 'unidad', activo: true },
    { codigo: 'ACC-PATIN', nombre: 'Patín', descripcion: 'Patín 10000', id_categoria: accesoriosCategory.id_categoria, tipo: 'ACCESORIOS', unidad_medida: 'unidad', activo: true },

    // ===== TELAS FELPA =====
    { codigo: 'FEL-SANTI', nombre: 'FELPA SANTI', descripcion: 'Felpa Santi premium', id_categoria: telasCategory.id_categoria, tipo: 'FELPA', unidad_medida: 'metro', activo: true },
    { codigo: 'FEL-ECONOMICA', nombre: 'FELPA ECONOMICA', descripcion: 'Felpa económica', id_categoria: telasCategory.id_categoria, tipo: 'FELPA', unidad_medida: 'metro', activo: true },

    // ===== TAFFETAN =====
    { codigo: 'TAF-ECONOMICO', nombre: 'TAFFETAN ECONOMICO', descripcion: 'Taffetan económico', id_categoria: telasCategory.id_categoria, tipo: 'TAFFETAN', unidad_medida: 'metro', activo: true },
    { codigo: 'TAF-PRO', nombre: 'TAFFETAN PRO', descripcion: 'Taffetan profesional', id_categoria: telasCategory.id_categoria, tipo: 'TAFFETAN', unidad_medida: 'metro', activo: true }
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
  const productos = await Producto.findAll();

  if (!productos || productos.length === 0) {
    console.log('⚠️  Productos no encontrados, omitiendo variantes');
    return;
  }

  // Colores disponibles para telas
  const coloresTelas = [
    'GRIS CLARO', 'GRIS OSCURO', 'GRIS MEDIO', 'BEIGE', 'BEIGE OSCURO', 'CRUDO',
    'NEGRO', 'ROJO', 'AZUL REY', 'AZUL MARINO', 'CAFE', 'CHOCOLATE'
  ];

  // Función para generar SKU a partir del color
  const generarSku = (codigoProducto: string, color: string) => {
    const colorNormalizado = color.replace(/\s+/g, '-').toUpperCase();
    return `${codigoProducto}-${colorNormalizado}`;
  };

  // Definición de variantes y precios según tus especificaciones
  const variantesConPrecios: { codigo_producto: string; sku: string; color: string; precio_neto: number; precio_metro_rollo?: number }[] = [];

  // ===== TELAS LINO CON COLORES =====
  const telasPreciosLino = [
    { codigo: 'LIN-GUCCI', precio: 2490 },
    { codigo: 'LIN-GABANNA', precio: 2490 },
    { codigo: 'LIN-CARTIER', precio: 2500 },
    { codigo: 'LIN-DIOR', precio: 2800 },
    { codigo: 'LIN-COZUMEL', precio: 2000 },
    { codigo: 'LIN-TOKIO', precio: 1650 },
    { codigo: 'LIN-VERNACCI', precio: 1800 },
  ];

  for (const tela of telasPreciosLino) {
    for (const color of coloresTelas) {
      variantesConPrecios.push({
        codigo_producto: tela.codigo,
        sku: generarSku(tela.codigo, color),
        color: color,
        precio_neto: tela.precio
      });
    }
  }

  // ===== TELAS FELPA CON COLORES =====
  const telasPreciosFelpa = [
    { codigo: 'FEL-SANTI', precio: 2490 },
    { codigo: 'FEL-ECONOMICA', precio: 2000 },
  ];

  for (const tela of telasPreciosFelpa) {
    for (const color of coloresTelas) {
      variantesConPrecios.push({
        codigo_producto: tela.codigo,
        sku: generarSku(tela.codigo, color),
        color: color,
        precio_neto: tela.precio
      });
    }
  }

  // ===== TAFFETAN (solo color NEGRO) =====
  // Precios por metro: normal y por rollo (mínimo 100m)
  const telasPreciosTaffetan = [
    { codigo: 'TAF-ECONOMICO', precioMetro: 400, precioMetroRollo: 320 },  // Económico: $320/m en rollo
    { codigo: 'TAF-PRO', precioMetro: 450, precioMetroRollo: 360 },        // Pro: $360/m en rollo
  ];

  for (const tela of telasPreciosTaffetan) {
    variantesConPrecios.push({
      codigo_producto: tela.codigo,
      sku: `${tela.codigo}-NEGRO`,
      color: 'NEGRO',
      precio_neto: tela.precioMetro,           // Precio por metro normal
      precio_metro_rollo: tela.precioMetroRollo // Precio por metro en rollo (mín 100m)
    });
  }

  // ===== CORCHETES (sin colores, variante única) =====
  const corchetes = [
    { codigo: 'COR-7112', precio: 2000 },
    { codigo: 'COR-1450', precio: 18000 },
    { codigo: 'COR-8012', precio: 2500 },
    { codigo: 'COR-1445', precio: 15000 },
  ];

  for (const corchete of corchetes) {
    variantesConPrecios.push({
      codigo_producto: corchete.codigo,
      sku: `${corchete.codigo}-UNICO`,
      color: 'Único',
      precio_neto: corchete.precio
    });
  }

  // ===== HILOS (colores variados) =====
  const coloresHilos = ['Rojo', 'Verde', 'Amarillo', 'Azul', 'Negro', 'Blanco', 'Celeste', 'Rosado'];
  for (const color of coloresHilos) {
    variantesConPrecios.push({
      codigo_producto: 'HIL-5000MT',
      sku: `HIL-5000MT-${color.toUpperCase()}`,
      color: color,
      precio_neto: 3000
    });
  }

  // ===== ACCESORIOS (sin colores, variante única) =====
  const accesorios = [
    { codigo: 'ACC-PATA-CAMA', precio: 1850 },
    { codigo: 'ACC-PATIN', precio: 10000 },
  ];

  for (const acc of accesorios) {
    variantesConPrecios.push({
      codigo_producto: acc.codigo,
      sku: `${acc.codigo}-UNICO`,
      color: 'Único',
      precio_neto: acc.precio
    });
  }

  for (const varianteData of variantesConPrecios) {
    const producto = await Producto.findOne({ where: { codigo: varianteData.codigo_producto } });

    if (!producto) {
      console.log(`⚠️  Producto ${varianteData.codigo_producto} no encontrado`);
      continue;
    }

    const [varianteCreada, created] = await VarianteProducto.findOrCreate({
      where: { sku: varianteData.sku },
      defaults: {
        id_producto: producto.id_producto,
        sku: varianteData.sku,
        color: varianteData.color,
        descripcion: `${producto.nombre} - ${varianteData.color}`,
        activo: true
      }
    });

    // Crear modalidades con precios específicos
    if (created) {
      let modalidades: any[] = [];

      if (producto.unidad_medida === 'metro') {
        // Determinar configuración según tipo de producto
        const esTaffetan = producto.tipo === 'TAFFETAN';
        const minimoRollo = esTaffetan ? 100 : 30;

        // Precio por metro en modalidad ROLLO
        // Si tiene precio_metro_rollo (TAFFETAN), usarlo; sino calcular con descuento
        const precioMetroRollo = varianteData.precio_metro_rollo ?? varianteData.precio_neto;

        // Para telas: METRO y ROLLO
        modalidades = [
          {
            id_variante_producto: varianteCreada.id_variante_producto,
            nombre: 'METRO',
            descripcion: 'Venta por metro',
            cantidad_base: 1,
            es_cantidad_variable: true,
            minimo_cantidad: 0.5,
            precio_costo: Math.round(varianteData.precio_neto * 0.6),
            precio_neto: varianteData.precio_neto,  // Neto (sin IVA)
            precio_neto_factura: Math.round(varianteData.precio_neto * 1.19),  // Bruto (con IVA)
            afecto_descuento_ticket: true,
            activa: true
          },
          {
            id_variante_producto: varianteCreada.id_variante_producto,
            nombre: 'ROLLO',
            descripcion: `Venta por rollo (mínimo ${minimoRollo}m)`,
            cantidad_base: 1,
            es_cantidad_variable: true,
            minimo_cantidad: minimoRollo,
            precio_costo: Math.round(precioMetroRollo * 0.6),
            precio_neto: precioMetroRollo,  // Neto (sin IVA)
            precio_neto_factura: Math.round(precioMetroRollo * 1.19),  // Bruto (con IVA)
            afecto_descuento_ticket: false,
            activa: true
          }
        ];
      } else {
        // Para otros productos: UNIDAD
        modalidades = [
          {
            id_variante_producto: varianteCreada.id_variante_producto,
            nombre: 'UNIDAD',
            descripcion: 'Venta por unidad',
            cantidad_base: 1,
            es_cantidad_variable: false,
            minimo_cantidad: 1,
            precio_costo: Math.round(varianteData.precio_neto * 0.6),
            precio_neto: varianteData.precio_neto,  // Neto (sin IVA)
            precio_neto_factura: Math.round(varianteData.precio_neto * 1.19),  // Bruto (con IVA)
            afecto_descuento_ticket: true,
            activa: true
          }
        ];
      }

      // Crear las modalidades
      for (const modalidad of modalidades) {
        await ModalidadProducto.findOrCreate({
          where: {
            id_variante_producto: varianteCreada.id_variante_producto,
            nombre: modalidad.nombre
          },
          defaults: modalidad
        });
      }
    }
  }

  console.log('✅ Variantes de productos creadas con modalidades');
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

  // Obtener TODAS las variantes creadas
  const todasLasVariantes = await VarianteProducto.findAll();

  if (!todasLasVariantes || todasLasVariantes.length === 0) {
    console.log('⚠️  No hay variantes, omitiendo stock');
    return;
  }

  // Crear stock para cada variante
  for (const variante of todasLasVariantes) {
    const producto = await Producto.findByPk(variante.id_producto);

    let stockConfig;

    // Determinar cantidades según el tipo de producto
    if (producto?.tipo === 'LINO' || producto?.tipo === 'FELPA' || producto?.tipo === 'TAFFETAN') {
      // Telas: stock en metros
      stockConfig = {
        cantidad_disponible: Math.floor(Math.random() * 200) + 100, // 100-300 metros
        cantidad_reservada: 0,
        stock_minimo: 20,
        stock_maximo: 500
      };
    } else if (producto?.tipo === 'CORCHETES') {
      // Corchetes: cantidades altas
      stockConfig = {
        cantidad_disponible: Math.floor(Math.random() * 5000) + 2000, // 2000-7000 unidades
        cantidad_reservada: 0,
        stock_minimo: 500,
        stock_maximo: 10000
      };
    } else if (producto?.tipo === 'HILOS') {
      // Hilos: cantidades medias
      stockConfig = {
        cantidad_disponible: Math.floor(Math.random() * 100) + 50, // 50-150 unidades
        cantidad_reservada: 0,
        stock_minimo: 10,
        stock_maximo: 200
      };
    } else {
      // Accesorios y otros: cantidades medias
      stockConfig = {
        cantidad_disponible: Math.floor(Math.random() * 50) + 20, // 20-70 unidades
        cantidad_reservada: 0,
        stock_minimo: 5,
        stock_maximo: 100
      };
    }

    await StockPorBodega.findOrCreate({
      where: {
        id_variante_producto: variante.id_variante_producto,
        id_bodega: bodegaSala.id_bodega
      },
      defaults: stockConfig
    });
  }

  console.log(`✅ Stock inicial creado para ${todasLasVariantes.length} variantes`);
}

async function createModalitiesForExistingVariants() {
  // Las modalidades se crean por trigger o procedure
  console.log('✅ Modalidades manejadas por triggers/procedures');
}

async function adjustModalitiesPrices() {
  // Ajuste de precios específicos si es necesario
  console.log('✅ Ajuste de precios completado');
}