// src/utils/loadProcedures.ts - CON VERIFICACIÓN COMPLETA
import { sequelize } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

export async function loadFullDatabase(): Promise<void> {
  try {
    console.log('🔧 Cargando base de datos con verificación completa...');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const forceDevData = process.env.FORCE_DEVELOPMENT_DATA === 'true';
    const shouldLoadSampleData = isDevelopment || forceDevData;
    
    console.log(`   🏷️ Entorno: ${process.env.NODE_ENV}`);
    console.log(`   🎯 FORCE_DEVELOPMENT_DATA: ${forceDevData}`);
    console.log(`   🌱 Modo final: ${shouldLoadSampleData ? 'DESARROLLO (con datos)' : 'PRODUCCIÓN (sin datos)'}`);
    
    // 1. VERIFICAR Y CREAR ESTRUCTURA BÁSICA
    await ensureBasicStructure();
    
    // 2. CARGAR DATOS DE EJEMPLO SI CORRESPONDE
    if (shouldLoadSampleData) {
      console.log('🎯 Cargando datos de ejemplo para desarrollo...');
      await loadDevelopmentSampleData();
    } else {
      console.log('🏭 Modo producción: Omitiendo datos de ejemplo');
    }
    
    // 3. MOSTRAR RESUMEN FINAL
    await showFinalSummary();
    
    console.log('✅ Base de datos configurada completamente');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
    throw error;
  }
}

async function ensureBasicStructure(): Promise<void> {
  try {
    console.log('🔍 Verificando estructura básica de la base de datos...');
    
    // Verificar que las tablas principales existen
    const [tables] = await sequelize.query("SHOW TABLES");
    console.log(`📊 Tablas encontradas: ${tables.length}`);
    
    if (tables.length < 10) {
      console.log('⚠️ Pocas tablas encontradas, creando estructura básica...');
      await createBasicStructure();
    }
    
    // Verificar y crear categorías
    await ensureCategoriesExist();
    
    // Verificar y crear otros datos básicos
    await ensureBasicMasterData();
    
    console.log('✅ Estructura básica verificada');
    
  } catch (error) {
    console.error('❌ Error verificando estructura básica:', error);
    throw error;
  }
}

async function createBasicStructure(): Promise<void> {
  try {
    console.log('🏗️ Creando estructura básica de tablas...');
    
    // Si llegamos aquí, es probable que el SQL del archivo no se ejecutó correctamente
    // Cargar desde el archivo SQL si existe
    const sqlFilePath = findSqlFile();
    if (sqlFilePath) {
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Solo ejecutar la parte de estructura (hasta datos de ejemplo)
      const structureOnly = sqlContent.split('-- DEVELOPMENT_SAMPLE_DATA_START')[0];
      
      await executeSqlStatements(structureOnly);
      console.log('✅ Estructura cargada desde archivo SQL');
    } else {
      console.log('⚠️ Archivo SQL no encontrado, usando Sequelize sync');
      // Como último recurso, usar Sequelize para crear las tablas
      await sequelize.sync({ force: false, alter: false });
    }
    
  } catch (error) {
    console.error('❌ Error creando estructura básica:', error);
    throw error;
  }
}

async function ensureCategoriesExist(): Promise<void> {
  try {
    console.log('📂 Verificando categorías...');
    
    // Verificar categorías existentes
    const [categories] = await sequelize.query('SELECT id_categoria, nombre FROM categorias ORDER BY id_categoria');
    console.log(`📊 Categorías encontradas: ${categories.length}`);
    
    if (categories.length === 0) {
      console.log('🏗️ Creando categorías básicas...');
      
      await sequelize.query(`
        INSERT INTO categorias (nombre, descripcion) VALUES
        ('TELAS', 'Diferentes tipos de telas y materiales'),
        ('BOTONES', 'Botones de diferentes tipos y tamaños'),
        ('PATAS', 'Patas y accesorios de costura'),
        ('CORCHETES', 'Corchetes metálicos de diferentes medidas'),
        ('HILOS', 'Hilos y elementos de bordado')
      `);
      
      // Verificar que se crearon
      const [newCategories] = await sequelize.query('SELECT id_categoria, nombre FROM categorias ORDER BY id_categoria');
      console.log('✅ Categorías creadas:');
      newCategories.forEach((cat: any) => {
        console.log(`   📂 ID: ${cat.id_categoria} - ${cat.nombre}`);
      });
    } else {
      console.log('✅ Categorías existentes:');
      categories.forEach((cat: any) => {
        console.log(`   📂 ID: ${cat.id_categoria} - ${cat.nombre}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error verificando categorías:', error);
    throw error;
  }
}

async function ensureBasicMasterData(): Promise<void> {
  try {
    console.log('🔧 Verificando datos maestros básicos...');
    
    // Verificar roles
    const [roles] = await sequelize.query('SELECT COUNT(*) as count FROM roles');
    if ((roles[0] as any).count === 0) {
      console.log('👥 Creando roles básicos...');
      await sequelize.query(`
        INSERT INTO roles (nombre, descripcion, permisos) VALUES
        ('ADMINISTRADOR', 'Acceso completo al sistema', '["admin", "ventas", "productos", "usuarios"]'),
        ('CAJERO', 'Acceso a ventas y caja', '["ventas", "pagos"]'),
        ('VENDEDOR', 'Acceso a pedidos y productos', '["pedidos", "productos.ver"]')
      `);
    }
    
    // Verificar tipos de documento
    const [tiposDoc] = await sequelize.query('SELECT COUNT(*) as count FROM tipos_documento');
    if ((tiposDoc[0] as any).count === 0) {
      console.log('📄 Creando tipos de documento...');
      await sequelize.query(`
        INSERT INTO tipos_documento (nombre, codigo, requiere_rut_cliente, es_fiscal, aplica_iva) VALUES
        ('Ticket', 'TIC', FALSE, FALSE, FALSE),
        ('Boleta', 'BOL', FALSE, TRUE, FALSE),
        ('Factura', 'FAC', TRUE, TRUE, TRUE)
      `);
    }
    
    // Verificar bodegas
    const [bodegas] = await sequelize.query('SELECT COUNT(*) as count FROM bodegas');
    if ((bodegas[0] as any).count === 0) {
      console.log('🏪 Creando bodegas básicas...');
      await sequelize.query(`
        INSERT INTO bodegas (codigo, nombre, descripcion, es_punto_venta) VALUES
        ('SALA', 'Sala de Ventas', 'Punto de venta principal', TRUE),
        ('BOD1', 'Bodega Principal', 'Bodega Temuco', FALSE)
      `);
    }
    
    // Verificar métodos de pago
    const [metodos] = await sequelize.query('SELECT COUNT(*) as count FROM metodos_pago');
    if ((metodos[0] as any).count === 0) {
      console.log('💳 Creando métodos de pago...');
      await sequelize.query(`
        INSERT INTO metodos_pago (nombre, codigo, tipo, requiere_referencia) VALUES
        ('Efectivo', 'EFE', 'efectivo', FALSE),
        ('Tarjeta Débito', 'DEB', 'tarjeta', TRUE),
        ('Tarjeta Crédito', 'CRE', 'tarjeta', TRUE),
        ('Transferencia', 'TRA', 'transferencia', TRUE)
      `);
    }
    
    // Verificar cajas
    const [cajas] = await sequelize.query('SELECT COUNT(*) as count FROM cajas');
    if ((cajas[0] as any).count === 0) {
      console.log('🏪 Creando cajas registradoras...');
      await sequelize.query(`
        INSERT INTO cajas (nombre, ubicacion, activa) VALUES
        ('Caja Principal', 'Mostrador Principal', TRUE)
      `);
    }
    
    console.log('✅ Datos maestros verificados');
    
  } catch (error) {
    console.error('❌ Error verificando datos maestros:', error);
    throw error;
  }
}

async function loadDevelopmentSampleData(): Promise<void> {
  try {
    console.log('🛍️ Verificando datos de ejemplo...');
    
    // Verificar si ya hay productos
    const [products] = await sequelize.query('SELECT COUNT(*) as count FROM productos');
    const productCount = (products[0] as any).count;
    
    if (productCount > 0) {
      console.log(`✅ Ya existen ${productCount} productos - omitiendo carga de ejemplos`);
      return;
    }
    
    console.log('📦 Creando productos de ejemplo...');
    
    // Primero verificar que las categorías existen
    const [categorias] = await sequelize.query('SELECT id_categoria, nombre FROM categorias ORDER BY id_categoria');
    console.log('📂 Categorías disponibles para productos:');
    categorias.forEach((cat: any) => {
      console.log(`   📂 ID: ${cat.id_categoria} - ${cat.nombre}`);
    });
    
    // Crear productos usando IDs de categorías que SÍ existen
    const categoriaExistente = (categorias[0] as any)?.id_categoria || 1;
    
    await sequelize.query(`
      INSERT INTO productos (codigo, nombre, descripcion, id_categoria, tipo, unidad_medida, precio_costo_base, precio_neto_base, precio_neto_factura_base) VALUES
      ('LIN-GUCCI-001', 'GUCCI', 'Línea GUCCI de telas de lino premium', ${categoriaExistente}, 'LINO', 'metro', 2500, 3800, 3193),
      ('LIN-VERSACE-001', 'VERSACE', 'Línea VERSACE de telas de lino', ${categoriaExistente}, 'LINO', 'metro', 2300, 3500, 2941),
      ('FEL-PREMIUM-001', 'PREMIUM', 'Línea premium de felpa suave', ${categoriaExistente}, 'FELPA', 'metro', 1800, 2500, 2101),
      ('COR-MEDIDAS-001', 'Corchetes Varios', 'Corchetes metálicos de diferentes medidas', ${categoriaExistente}, 'CORCHETES', 'unidad', 100, 150, 126),
      ('ACC-BOT-001', 'Botones Clásicos', 'Botones básicos para confección', ${categoriaExistente}, NULL, 'unidad', 100, 150, 126)
    `);
    
    console.log('🎨 Creando variantes de productos...');
    
    await sequelize.query(`
      INSERT INTO variantes_producto (id_producto, sku, color, medida, descripcion) VALUES
      (1, 'LIN-GUCCI-BLA', 'Blanco', NULL, 'Lino Gucci color Blanco'),
      (1, 'LIN-GUCCI-NEG', 'Negro', NULL, 'Lino Gucci color Negro'),
      (1, 'LIN-GUCCI-AZU', 'Azul', NULL, 'Lino Gucci color Azul'),
      (2, 'LIN-VERSACE-BLA', 'Blanco', NULL, 'Lino Versace color Blanco'),
      (2, 'LIN-VERSACE-NEG', 'Negro', NULL, 'Lino Versace color Negro'),
      (3, 'FEL-PREMIUM-GRI', 'Gris', NULL, 'Felpa premium color Gris'),
      (4, 'COR-71', NULL, '71', 'Corchete medida 71'),
      (4, 'COR-12', NULL, '12', 'Corchete medida 12'),
      (4, 'COR-1445', NULL, '1445', 'Corchete medida 1445'),
      (5, 'ACC-BOT-NE', 'Negro', NULL, 'Botones negros clásicos')
    `);
    
    console.log('🎯 Creando modalidades de venta...');
    
    await sequelize.query(`
      INSERT INTO modalidades_producto (id_variante_producto, nombre, descripcion, cantidad_base, es_cantidad_variable, minimo_cantidad, precio_costo, precio_neto, precio_neto_factura) VALUES
      -- LINO GUCCI
      (1, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 2500, 3800, 3193),
      (1, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 2250, 3420, 2874),
      (2, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 2500, 3800, 3193),
      (2, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 2250, 3420, 2874),
      (3, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 2500, 3800, 3193),
      (3, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 2250, 3420, 2874),
      
      -- LINO VERSACE  
      (4, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 2300, 3500, 2941),
      (4, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 2070, 3150, 2647),
      (5, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 2300, 3500, 2941),
      (5, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 2070, 3150, 2647),
      
      -- FELPA PREMIUM
      (6, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, 1800, 2500, 2101),
      (6, 'ROLLO', 'Rollo completo', 25, FALSE, 25, 1620, 2250, 1891),
      
      -- CORCHETES con precios diferenciados
      (7, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, 85, 160, 134),
      (8, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, 90, 170, 143),
      (9, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, 120, 220, 185),
      
      -- BOTONES
      (10, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, 100, 150, 126)
    `);
    
    console.log('📊 Creando stock inicial...');
    
    await sequelize.query(`
      INSERT INTO stock_por_bodega (id_variante_producto, id_bodega, cantidad_disponible) VALUES
      (1, 1, 150.0), (2, 1, 120.0), (3, 1, 80.0),   -- LINO GUCCI
      (4, 1, 100.0), (5, 1, 90.0),                   -- LINO VERSACE
      (6, 1, 75.0),                                  -- FELPA PREMIUM
      (7, 1, 500), (8, 1, 300), (9, 1, 150),        -- CORCHETES
      (10, 1, 200)                                   -- BOTONES
    `);
    
    // Cliente de ejemplo
    await sequelize.query(`
      INSERT IGNORE INTO clientes (rut, tipo_cliente, nombre, datos_completos) VALUES
      ('12345678-9', 'empresa', 'Cliente por completar datos', FALSE)
    `);
    
    console.log('✅ Datos de ejemplo creados exitosamente');
    
  } catch (error) {
    console.error('❌ Error cargando datos de ejemplo:', error);
    throw error;
  }
}

async function showFinalSummary(): Promise<void> {
  try {
    console.log('📊 RESUMEN FINAL DE LA BASE DE DATOS:');
    
    const [productos] = await sequelize.query('SELECT COUNT(*) as count FROM productos');
    const [variantes] = await sequelize.query('SELECT COUNT(*) as count FROM variantes_producto');
    const [modalidades] = await sequelize.query('SELECT COUNT(*) as count FROM modalidades_producto');
    const [stocks] = await sequelize.query('SELECT COUNT(*) as count FROM stock_por_bodega');
    const [usuarios] = await sequelize.query('SELECT COUNT(*) as count FROM usuarios');
    const [categorias] = await sequelize.query('SELECT COUNT(*) as count FROM categorias');
    
    console.log(`   📦 Productos: ${(productos[0] as any).count}`);
    console.log(`   🎨 Variantes: ${(variantes[0] as any).count}`);
    console.log(`   🎯 Modalidades: ${(modalidades[0] as any).count}`);
    console.log(`   📊 Stocks: ${(stocks[0] as any).count}`);
    console.log(`   👥 Usuarios: ${(usuarios[0] as any).count}`);
    console.log(`   📂 Categorías: ${(categorias[0] as any).count}`);
    
    // Verificar procedures/functions
    const [procedures] = await sequelize.query("SHOW PROCEDURE STATUS WHERE Db = DATABASE()");
    const [functions] = await sequelize.query("SHOW FUNCTION STATUS WHERE Db = DATABASE()");
    
    console.log(`   📋 Procedures MySQL: ${procedures.length}`);
    console.log(`   🔧 Functions MySQL: ${functions.length}`);
    console.log(`   ⚙️ Lógica de negocio: Implementada en JavaScript`);
    
    if (procedures.length === 0 && functions.length === 0) {
      console.log('');
      console.log('ℹ️  NOTA: Las funciones y procedures están implementadas en JavaScript');
      console.log('   ubicadas en src/utils/businessLogic.ts para mejor mantenibilidad');
    }
    
  } catch (error) {
    console.error('❌ Error mostrando resumen:', error);
  }
}

function findSqlFile(): string | null {
  const possiblePaths = [
    path.join(__dirname, '../../database/santitelas.sql'),
    path.join(process.cwd(), 'database/santitelas.sql'),
    path.join(__dirname, '../../santitelas.sql'),
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  return null;
}

async function executeSqlStatements(sqlContent: string): Promise<void> {
  try {
    console.log('🚀 Ejecutando statements SQL...');
    
    // Dividir en statements
    const statements = sqlContent
      .split(/;\s*$\s*/gm)
      .filter(statement => statement.trim().length > 0)
      .filter(statement => !statement.trim().match(/^(--|#)/));
    
    console.log(`📊 ${statements.length} statements SQL a ejecutar`);
    
    // Configurar MySQL
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      try {
        if (i % 10 === 0) {
          console.log(`   📊 Ejecutados: ${i}/${statements.length}`);
        }
        
        await sequelize.query(statement);
        successCount++;
        
      } catch (error: any) {
        if (error.message?.includes('already exists') || 
            error.message?.includes('Duplicate entry')) {
          skipCount++;
        } else {
          console.warn(`⚠️ Error en statement ${i + 1}:`, error.message?.substring(0, 100));
        }
      }
    }
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('✅ Ejecución SQL completada');
    console.log(`   📊 Ejecutados: ${successCount}/${statements.length}`);
    if (skipCount > 0) {
      console.log(`   ⚠️ Omitidos: ${skipCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando SQL:', error);
    throw error;
  }
}