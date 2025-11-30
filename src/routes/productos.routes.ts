// src/routes/productos.routes.ts - VERSIÓN CORREGIDA
import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { Producto } from '../models/Producto.model';
import { VarianteProducto } from '../models/VarianteProducto.model';
import { ModalidadProducto } from '../models/ModalidadProducto.model';
import { Categoria } from '../models/Categoria.model';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { Bodega } from '../models/Bodega.model';
import { Op } from 'sequelize';
import { sequelize } from '../config/database'; // ✅ AGREGADO

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: productos
 *     description: Gestión de productos con estructura jerárquica
 *   - name: catalogo
 *     description: Consultas del catálogo de productos
 *   - name: estructura
 *     description: Obtener la estructura jerárquica de productos
 */

// ===========================
// RUTAS PRINCIPALES DEL CATÁLOGO
// ===========================

/**
 * @openapi
 * /productos/catalogo:
 *   get:
 *     summary: Obtener catálogo completo con estructura jerárquica
 *     tags:
 *       - catalogo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoria
 *         schema:
 *           type: string
 *         description: Filtrar por categoría (TELAS, CORCHETES, PATAS, BOTONES)
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtrar por tipo (LINO, FELPA, PATA CONICA, etc.)
 *       - in: query
 *         name: modelo
 *         schema:
 *           type: string
 *         description: Filtrar por modelo (GABANNA, GUCCI, etc.)
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Filtrar por color (Azul, Rojo, etc.)
 *       - in: query
 *         name: medida
 *         schema:
 *           type: string
 *         description: Filtrar por medida/número (71, 12, etc.)
 *       - in: query
 *         name: modalidad
 *         schema:
 *           type: string
 *         description: Filtrar por modalidad de venta (METRO, ROLLO, KILO, etc.)
 *       - in: query
 *         name: precio_min
 *         schema:
 *           type: number
 *         description: Precio mínimo
 *       - in: query
 *         name: precio_max
 *         schema:
 *           type: number
 *         description: Precio máximo
 *       - in: query
 *         name: con_stock
 *         schema:
 *           type: boolean
 *         description: Solo productos con stock disponible
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda general en nombre, código o descripción
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página para paginación
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Elementos por página
 *     responses:
 *       '200':
 *         description: Catálogo de productos con estructura jerárquica
 */





router.get('/catalogo', async (req, res, next) => {
  try {
    const {
      categoria,
      tipo,
      modelo,
      color,
      medida,
      modalidad,
      precio_min,
      precio_max,
      con_stock,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Construir filtros
    const whereProducto: any = { activo: true };
    const whereVariante: any = { activo: true };
    const whereModalidades: any = { activa: true };

    // Configurar include de categoría
    const includeCategoria: any = {
      model: Categoria,
      as: 'categoria',
      attributes: ['id_categoria', 'nombre'],
      required: true // Asegurar que siempre esté presente
    };

    // Si hay filtro de categoría, aplicarlo
    if (categoria) {
      includeCategoria.where = { nombre: categoria };
    }

    // Filtros de producto
    if (tipo) {
      whereProducto.tipo = tipo;
    }
    if (modelo) {
      whereProducto.nombre = { [Op.like]: `%${modelo}%` }; // ✅ Cambiado a like
    }
    
    // ✅ BÚSQUEDA MEJORADA - Buscar en productos O variantes
    if (search) {
      // Primero, buscar productos que coincidan directamente
      const productosDirectos = await Producto.findAll({
        attributes: ['id_producto'],
        where: {
          activo: true,
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { codigo: { [Op.like]: `%${search}%` } },
            { descripcion: { [Op.like]: `%${search}%` } },
            { tipo: { [Op.like]: `%${search}%` } }
          ]
        },
        raw: true
      });

      // Luego, buscar productos que tengan variantes que coincidan
      const productosConVariantes = await VarianteProducto.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('id_producto')), 'id_producto']],
        where: {
          activo: true,
          [Op.or]: [
            { color: { [Op.like]: `%${search}%` } },
            { medida: { [Op.like]: `%${search}%` } },
            { material: { [Op.like]: `%${search}%` } },
            { sku: { [Op.like]: `%${search}%` } }
          ]
        },
        raw: true
      });

      // Combinar los IDs únicos
      const todosLosIds = new Set([
        ...productosDirectos.map(p => p.id_producto),
        ...productosConVariantes.map(p => p.id_producto)
      ]);

      // Si hay resultados, filtrar solo por esos IDs
      if (todosLosIds.size > 0) {
        whereProducto.id_producto = { [Op.in]: Array.from(todosLosIds) };
      } else {
        // No hay resultados - asegurar que no se devuelva nada
        whereProducto.id_producto = { [Op.in]: [] };
      }
    }

    // Filtros de variante específicos
    if (color) whereVariante.color = color;
    if (medida) whereVariante.medida = medida;

    // Filtros de modalidad
    if (modalidad) whereModalidades.nombre = modalidad;
    if (precio_min) whereModalidades.precio_neto = { [Op.gte]: precio_min };
    if (precio_max) {
      whereModalidades.precio_neto = {
        ...whereModalidades.precio_neto,
        [Op.lte]: precio_max
      };
    }

    // Paginación
    const offset = (Number(page) - 1) * Number(limit);

    // Consulta principal - con ORDER BY simplificado
    const { count, rows: productos } = await Producto.findAndCountAll({
      where: whereProducto,
      include: [
        includeCategoria,
        {
          model: VarianteProducto,
          as: 'variantes',
          where: whereVariante,
          required: !search && Object.keys(whereVariante).length > 1, // ✅ Mejorado
          include: [
            {
              model: ModalidadProducto,
              as: 'modalidades',
              where: whereModalidades,
              required: true,
              attributes: [
                'id_modalidad', 'nombre', 'descripcion', 'cantidad_base',
                'es_cantidad_variable', 'minimo_cantidad', 'precio_costo',
                'precio_neto', 'precio_neto_factura', 'afecto_descuento_ticket'
              ]
            },
            {
              model: StockPorBodega,
              as: 'stockPorBodega',
              required: con_stock === 'true',
              include: [{
                model: Bodega,
                as: 'bodega',
                attributes: ['id_bodega', 'nombre', 'codigo']
              }]
            }
          ]
        }
      ],
      limit: Number(limit),
      offset: offset,
      distinct: true,
      // ORDER BY simplificado sin referencias a joins
      order: [
        ['tipo', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    // Procesar datos y ordenar por categoría en memoria si es necesario
    const catalogoEstructurado = productos.map(producto => {
      const productData = producto.toJSON();

      const todasModalidades: any[] = [];
      const variantes = productData.variantes.map((variante: any) => {
        const stockTotal = variante.stockPorBodega?.reduce(
          (sum: number, stock: any) => sum + stock.cantidad_disponible, 0
        ) || 0;

        if (con_stock === 'true' && stockTotal === 0) {
          return null;
        }

        const modalidadesVariante = variante.modalidades || [];
        todasModalidades.push(...modalidadesVariante);

        return {
          id_variante: variante.id_variante_producto,
          sku: variante.sku,
          color: variante.color,
          medida: variante.medida,
          material: variante.material,
          descripcion_opcion: [variante.color, variante.medida, variante.material]
            .filter(Boolean).join(' - ') || 'Estándar',
          stock_total: stockTotal,
          tiene_stock: stockTotal > 0,
          modalidades: modalidadesVariante.map((modalidad: any) => ({
            id_modalidad: modalidad.id_modalidad,
            nombre: modalidad.nombre,
            descripcion: modalidad.descripcion,
            cantidad_base: modalidad.cantidad_base,
            es_cantidad_variable: modalidad.es_cantidad_variable,
            minimo_cantidad: modalidad.minimo_cantidad,
            afecto_descuento_ticket: modalidad.afecto_descuento_ticket,
            precios: {
              costo: modalidad.precio_costo,
              neto: modalidad.precio_neto,
              factura: modalidad.precio_neto_factura,
              con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19)
            }
          }))
        };
      }).filter(Boolean);

      const todosPrecios = todasModalidades
        .map((m: any) => m.precio_neto)
        .filter(Boolean);

      const precioMinimo = todosPrecios.length > 0 ? Math.min(...todosPrecios) : 0;
      const precioMaximo = todosPrecios.length > 0 ? Math.max(...todosPrecios) : 0;

      return {
        id_producto: productData.id_producto,
        categoria: productData.categoria?.nombre || 'SIN CATEGORÍA',
        tipo: productData.tipo || 'SIN TIPO',
        modelo: productData.nombre,
        codigo: productData.codigo,
        descripcion: productData.descripcion,
        unidad_medida: productData.unidad_medida,
        opciones: variantes,
        resumen_precios: {
          precio_minimo: precioMinimo,
          precio_maximo: precioMaximo,
          rango_precios: precioMinimo === precioMaximo 
            ? `$${precioMinimo.toLocaleString('es-CL')}`
            : `$${precioMinimo.toLocaleString('es-CL')} - $${precioMaximo.toLocaleString('es-CL')}`
        },
        estadisticas: {
          total_opciones: variantes.length,
          total_modalidades: todasModalidades.length,
          tiene_stock: variantes.some((v: any) => v.tiene_stock)
        }
      };
    });

    // Ordenar por categoría en memoria
    catalogoEstructurado.sort((a, b) => {
      // Primero por categoría
      const catComp = a.categoria.localeCompare(b.categoria);
      if (catComp !== 0) return catComp;
      
      // Luego por tipo
      const tipoComp = (a.tipo || '').localeCompare(b.tipo || '');
      if (tipoComp !== 0) return tipoComp;
      
      // Finalmente por modelo
      return a.modelo.localeCompare(b.modelo);
    });

    // Información de paginación
    const totalPages = Math.ceil(count / Number(limit));

    res.json({
      success: true,
      data: catalogoEstructurado,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: totalPages
      },
      filtros_aplicados: {
        categoria, tipo, modelo, color, medida, modalidad,
        precio_min, precio_max, con_stock, search
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos/estructura:
 *   get:
 *     summary: Obtener la estructura jerárquica completa del catálogo
 *     description: Devuelve todas las categorías, tipos y modelos disponibles para construir filtros dinámicos
 *     tags:
 *       - estructura
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Estructura jerárquica del catálogo
 */
router.get('/estructura', async (req, res, next) => {
  try {
    // ✅ CONSULTA CORREGIDA: Modalidades desde variantes
    const productos = await Producto.findAll({
      where: { activo: true },
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [{
            model: ModalidadProducto,
            as: 'modalidades',
            where: { activa: true },
            required: false,
            attributes: ['nombre']
          }]
        }
      ],
      order: [
        [{ model: Categoria, as: 'categoria' }, 'nombre', 'ASC'],
        ['tipo', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    // Construir estructura jerárquica
    const estructura: any = {};

    productos.forEach(producto => {
      const categoria = producto.categoria?.nombre || 'SIN CATEGORÍA';
      const tipo = producto.tipo || 'SIN TIPO';
      const modelo = producto.nombre;

      // Inicializar estructura
      if (!estructura[categoria]) {
        estructura[categoria] = {};
      }
      if (!estructura[categoria][tipo]) {
        estructura[categoria][tipo] = {
          modelos: new Set(),
          colores: new Set(),
          medidas: new Set(),
          materiales: new Set(),
          modalidades: new Set()
        };
      }

      // Agregar modelo
      estructura[categoria][tipo].modelos.add(modelo);

      // Agregar opciones de variantes y modalidades
      producto.variantes?.forEach(variante => {
        if (variante.color) estructura[categoria][tipo].colores.add(variante.color);
        if (variante.medida) estructura[categoria][tipo].medidas.add(variante.medida);
        if (variante.material) estructura[categoria][tipo].materiales.add(variante.material);

        // ✅ MODALIDADES DESDE VARIANTES
        variante.modalidades?.forEach(modalidad => {
          estructura[categoria][tipo].modalidades.add(modalidad.nombre);
        });
      });
    });

    // Convertir Sets a Arrays y ordenar
    const estructuraFinal = Object.keys(estructura).sort().map(categoria => ({
      nombre: categoria,
      tipos: Object.keys(estructura[categoria]).sort().map(tipo => ({
        nombre: tipo,
        modelos: Array.from(estructura[categoria][tipo].modelos).sort(),
        opciones_disponibles: {
          colores: Array.from(estructura[categoria][tipo].colores).sort(),
          medidas: Array.from(estructura[categoria][tipo].medidas).sort(),
          materiales: Array.from(estructura[categoria][tipo].materiales).sort(),
          modalidades: Array.from(estructura[categoria][tipo].modalidades).sort()
        }
      }))
    }));

    // Resumen estadístico
    const resumen = {
      total_categorias: estructuraFinal.length,
      total_tipos: estructuraFinal.reduce((sum, cat) => sum + cat.tipos.length, 0),
      total_modelos: estructuraFinal.reduce((sum, cat) => 
        sum + cat.tipos.reduce((sumTipos, tipo) => sumTipos + tipo.modelos.length, 0), 0
      ),
      total_productos_activos: productos.length
    };

    res.json({
      success: true,
      data: {
        estructura: estructuraFinal,
        resumen: resumen
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos/{id}:
 *   get:
 *     summary: Obtener producto específico con toda su información jerárquica
 *     tags:
 *       - productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Producto con información completa
 *       '404':
 *         description: Producto no encontrado
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // ✅ CONSULTA CORREGIDA: Modalidades desde variantes
    const producto = await Producto.findByPk(id, {
      include: [
        {
          model: Categoria,
          as: 'categoria'
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          include: [
            {
              model: ModalidadProducto,
              as: 'modalidades',
              where: { activa: true },
              required: false
            },
            {
              model: StockPorBodega,
              as: 'stockPorBodega',
              include: [{
                model: Bodega,
                as: 'bodega',
                attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta']
              }]
            }
          ]
        }
      ]
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Procesar para estructura jerárquica
    const productData = producto.toJSON();
    
    // ✅ OBTENER MODALIDADES DESDE VARIANTES
    const todasModalidades: any[] = [];
    
    const variantes = productData.variantes.map((variante: any) => {
      const stockTotal = variante.stockPorBodega?.reduce(
        (sum: number, stock: any) => sum + stock.cantidad_disponible, 0
      ) || 0;

      const modalidadesVariante = variante.modalidades || [];
      todasModalidades.push(...modalidadesVariante);

      return {
        id_variante: variante.id_variante_producto,
        sku: variante.sku,
        color: variante.color,
        medida: variante.medida,
        material: variante.material,
        descripcion_opcion: [variante.color, variante.medida, variante.material]
          .filter(Boolean).join(' - ') || 'Estándar',
        stock_total: stockTotal,
        tiene_stock: stockTotal > 0,
        stock_por_bodega: variante.stockPorBodega.map((stock: any) => ({
          bodega: stock.bodega.nombre,
          codigo_bodega: stock.bodega.codigo,
          es_punto_venta: stock.bodega.es_punto_venta,
          cantidad_disponible: stock.cantidad_disponible,
          cantidad_reservada: stock.cantidad_reservada
        })),
        modalidades: modalidadesVariante.map((modalidad: any) => ({
          id_modalidad: modalidad.id_modalidad,
          nombre: modalidad.nombre,
          descripcion: modalidad.descripcion,
          cantidad_base: modalidad.cantidad_base,
          es_cantidad_variable: modalidad.es_cantidad_variable,
          minimo_cantidad: modalidad.minimo_cantidad,
          precios: {
            costo: modalidad.precio_costo,
            neto: modalidad.precio_neto,
            factura: modalidad.precio_neto_factura,
            con_iva: Math.round(Number(modalidad.precio_neto_factura) * 1.19)
          }
        }))
      };
    });

    const todosPrecios = todasModalidades
      .map((m: any) => m.precio_neto)
      .filter(Boolean);
    
    const precioMinimo = todosPrecios.length > 0 ? Math.min(...todosPrecios) : 0;
    const precioMaximo = todosPrecios.length > 0 ? Math.max(...todosPrecios) : 0;

    const productoEstructurado = {
      id_producto: productData.id_producto,
      categoria: productData.categoria?.nombre || 'SIN CATEGORÍA',
      tipo: productData.tipo || 'SIN TIPO',
      modelo: productData.nombre,
      codigo: productData.codigo,
      descripcion: productData.descripcion,
      unidad_medida: productData.unidad_medida,
      stock_minimo_total: productData.stock_minimo_total,
      opciones: variantes,
      resumen_precios: {
        precio_minimo: precioMinimo,
        precio_maximo: precioMaximo,
        rango_precios: precioMinimo === precioMaximo 
          ? `$${precioMinimo.toLocaleString('es-CL')}`
          : `$${precioMinimo.toLocaleString('es-CL')} - $${precioMaximo.toLocaleString('es-CL')}`
      },
      estadisticas: {
        total_opciones: variantes.length,
        total_modalidades: todasModalidades.length,
        stock_total: variantes.reduce((sum: number, v: any) => sum + v.stock_total, 0),
        tiene_stock: variantes.some((v: any) => v.tiene_stock)
      }
    };

    res.json({
      success: true,
      data: productoEstructurado
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /productos/buscar/rapida:
 *   get:
 *     summary: Búsqueda rápida de productos (para autocomplete)
 *     tags:
 *       - productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Límite de resultados
 *     responses:
 *       '200':
 *         description: Resultados de búsqueda rápida
 */
router.get('/buscar/rapida', async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    // ✅ CONSULTA CORREGIDA: Búsqueda con like para MySQL
    const productos = await Producto.findAll({
      where: {
        [Op.and]: [
          { activo: true },
          {
            [Op.or]: [
              { nombre: { [Op.like]: `%${q}%` } },      // ✅ Cambiado a like
              { codigo: { [Op.like]: `%${q}%` } },      // ✅ Cambiado a like
              { tipo: { [Op.like]: `%${q}%` } },        // ✅ Cambiado a like
              { descripcion: { [Op.like]: `%${q}%` } }  // ✅ Cambiado a like
            ]
          }
        ]
      },
      include: [
        {
          model: Categoria,
          as: 'categoria',
          attributes: ['nombre']
        },
        {
          model: VarianteProducto,
          as: 'variantes',
          where: { activo: true },
          required: false,
          include: [
            {
              model: ModalidadProducto,
              as: 'modalidades',
              where: { activa: true },
              required: false,
              attributes: ['precio_neto'],
              limit: 1,
              order: [['precio_neto', 'ASC']]
            },
            {
              model: StockPorBodega,
              as: 'stockPorBodega'
            }
          ]
        }
      ],
      limit: Number(limit),
      order: [['nombre', 'ASC']]
    });

    const resultados = productos.map(producto => {
      const productData = producto.toJSON();
      
      // Encontrar el precio más bajo desde todas las modalidades de todas las variantes
      let precioMinimo = Infinity;
      
      productData.variantes?.forEach((variante: any) => {
        variante.modalidades?.forEach((modalidad: any) => {
          if (modalidad.precio_neto < precioMinimo) {
            precioMinimo = modalidad.precio_neto;
          }
        });
      });

      return {
        id_producto: productData.id_producto,
        categoria: productData.categoria?.nombre || 'SIN CATEGORÍA',
        tipo: productData.tipo || 'SIN TIPO',
        modelo: productData.nombre,
        codigo: productData.codigo,
        descripcion_completa: `${productData.categoria?.nombre || ''} ${productData.tipo || ''} ${productData.nombre}`.trim(),
        precio_desde: precioMinimo === Infinity ? 0 : precioMinimo
      };
    });

    res.json({
      success: true,
      data: resultados
    });

  } catch (error) {
    next(error);
  }
});

export default router;