import { Router } from 'express';
import { auth } from '../middlewares/auth';
import { StockPorBodega } from '../models/StockPorBodega.model';
import { MovimientoStock } from '../models/MovimientoStock.model';
import { Producto } from '../models/Producto.model';
import { Bodega } from '../models/Bodega.model';
import { Categoria } from '../models/Categoria.model';
import { Usuario } from '../models/Usuario.model';
import { VarianteProducto } from '../models/VarianteProducto.model';

const router = Router();
router.use(auth);

// Helper para estado del stock
function getStockStatus(cantidadDisponible: number, stockMinimo: number): string {
  if (cantidadDisponible === 0) return 'sin_stock';
  if (cantidadDisponible < stockMinimo) return 'bajo_minimo';
  if (cantidadDisponible <= stockMinimo * 1.5) return 'alerta';
  return 'normal';
}

// =======================================================
// GET /stock : Stock general
// =======================================================
router.get('/', async (req, res, next) => {
  try {
    const { bodega, categoria, bajo_minimo, sin_stock } = req.query;

    const whereClause: any = {};
    if (bodega) whereClause.id_bodega = bodega;
    if (sin_stock === 'true') whereClause.cantidad_disponible = 0;

    // Armar include encadenado
    const includeVariante: any = {
      model: VarianteProducto,
      include: [{
        model: Producto,
        include: [{
          model: Categoria,
          attributes: ['id_categoria', 'nombre']
        }],
        where: { activo: true }
      }]
    };

    // Filtro por categoría
    if (categoria) {
      // Esto fuerza el where en Producto
      includeVariante.include[0].where.id_categoria = categoria;
    }

    const stockData = await StockPorBodega.findAll({
      where: whereClause,
      include: [
        includeVariante,
        {
          model: Bodega,
          attributes: ['id_bodega', 'nombre', 'codigo'],
          where: { activa: true }
        }
      ],
      order: [
        [{ model: VarianteProducto, as: 'varianteProducto' }, { model: Producto, as: 'producto' }, 'nombre', 'ASC'],
        [{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']
      ]
    });

    let filteredData = stockData;

    // Filtro por productos bajo mínimo
    if (bajo_minimo === 'true') {
      filteredData = stockData.filter(stock =>
        stock.cantidad_disponible < (stock.varianteProducto?.producto?.stock_minimo_total ?? 0)
      );
    }

    // Agregar información de estado del stock
    const dataWithStatus = filteredData.map(stock => {
      const producto = stock.varianteProducto?.producto;
      return {
        ...stock.toJSON(),
        estado_stock: getStockStatus(stock.cantidad_disponible, producto?.stock_minimo_total ?? 0),
        stock_total: stock.cantidad_disponible + stock.cantidad_reservada,
        producto // para el frontend
      };
    });

    res.json({
      success: true,
      data: dataWithStatus,
      resumen: {
        total_registros: dataWithStatus.length,
        productos_sin_stock: dataWithStatus.filter(s => s.cantidad_disponible === 0).length,
        productos_bajo_minimo: dataWithStatus.filter(s => s.cantidad_disponible < (s.producto?.stock_minimo_total ?? 0) && s.cantidad_disponible > 0).length
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/producto/:productoId
// =======================================================
router.get('/producto/:productoId', async (req, res, next) => {
  try {
    const { productoId } = req.params;

    // Verificar que el producto existe
    const producto = await Producto.findByPk(productoId, {
      include: [{
        model: Categoria,
        attributes: ['nombre']
      }]
    });
    if (!producto) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Buscar TODAS las variantes del producto
    const variantes = await VarianteProducto.findAll({
      where: { id_producto: productoId }
    });
    const variantesIds = variantes.map(v => v.id_variante_producto);

    // Buscar stock por bodega para esas variantes
    const stockPorBodega = await StockPorBodega.findAll({
      where: { id_variante_producto: variantesIds },
      include: [
        {
          model: VarianteProducto,
          include: [{ model: Producto }]
        },
        {
          model: Bodega,
          attributes: ['id_bodega', 'nombre', 'codigo', 'es_punto_venta'],
          where: { activa: true }
        }
      ],
      order: [[{ model: Bodega, as: 'bodega' }, 'nombre', 'ASC']]
    });

    const stockTotal = stockPorBodega.reduce((total, stock) =>
      total + stock.cantidad_disponible, 0
    );

    const stockReservadoTotal = stockPorBodega.reduce((total, stock) =>
      total + stock.cantidad_reservada, 0
    );

    res.json({
      success: true,
      data: {
        producto,
        stock_por_bodega: stockPorBodega,
        resumen: {
          stock_total_disponible: stockTotal,
          stock_total_reservado: stockReservadoTotal,
          stock_minimo: producto.stock_minimo_total,
          estado: getStockStatus(stockTotal, producto.stock_minimo_total)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =======================================================
// GET /stock/bodega/:bodegaId
// =======================================================
router.get('/bodega/:bodegaId', async (req, res, next) => {
  try {
    const { bodegaId } = req.params;

    // Verificar que la bodega existe
    const bodega = await Bodega.findByPk(bodegaId);
    if (!bodega) {
      return res.status(404).json({ success: false, message: 'Bodega no encontrada' });
    }

    const stockBodega = await StockPorBodega.findAll({
      where: { id_bodega: bodegaId },
      include: [
        {
          model: VarianteProducto,
          include: [{
            model: Producto,
            include: [{ model: Categoria, attributes: ['nombre'] }]
          }]
        }
      ],
      order: [[{ model: VarianteProducto, as: 'varianteProducto' }, { model: Producto, as: 'producto' }, 'nombre', 'ASC']]
    });

    const resumen = {
      total_productos: stockBodega.length,
      productos_con_stock: stockBodega.filter(s => s.cantidad_disponible > 0).length,
      productos_sin_stock: stockBodega.filter(s => s.cantidad_disponible === 0).length,
      // ✅ CORREGIDO: precio_costo_base en lugar de precio_costo
      valor_total_inventario: stockBodega.reduce((total, stock) =>
        total + (stock.cantidad_disponible * (stock.varianteProducto?.producto?.precio_costo_base ?? 0)), 0
      )
    };

    res.json({
      success: true,
      data: {
        bodega,
        stock: stockBodega,
        resumen
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;