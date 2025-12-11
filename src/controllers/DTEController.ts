// src/controllers/DTEController.ts
// Controlador para emisión de documentos tributarios electrónicos (boleta/factura)
// Usa DTEService que permite cambiar entre Relbase y LibreDTE

import { Request, Response, NextFunction } from 'express';
import dteService, { TipoDocumento } from '../services/DTEService';

export class DTEController {
  // POST /api/dte/boleta - Crear boleta electrónica
  async crearBoleta(req: Request, res: Response, next: NextFunction) {
    try {
      const { productos, comment, type_payment_id } = req.body;

      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere al menos un producto para crear la boleta'
        });
      }

      // Validar estructura de productos
      for (const p of productos) {
        if (!p.name || p.price === undefined || p.quantity === undefined) {
          return res.status(400).json({
            success: false,
            message: 'Cada producto debe tener name, price y quantity'
          });
        }
      }

      const resultado = await dteService.crearBoleta(productos, {
        comment,
        type_payment_id
      });

      if (resultado.success) {
        const respuesta = {
          success: true,
          data: {
            folio: resultado.folio,
            pdf_url: resultado.pdf_url,
            dte: resultado.data,
            provider: resultado.provider,
            modo_prueba: resultado.modo_prueba
          },
          message: `Boleta electrónica creada exitosamente. Folio: ${resultado.folio}${resultado.modo_prueba ? ' (MODO PRUEBA)' : ''}`
        };
        console.log(`📤 Boleta emitida via ${resultado.provider?.toUpperCase()}:`, resultado.folio);
        res.json(respuesta);
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error || 'Error al crear boleta',
          provider: resultado.provider
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // POST /api/dte/factura - Crear factura electrónica
  async crearFactura(req: Request, res: Response, next: NextFunction) {
    try {
      const { productos, cliente, comment, type_payment_id } = req.body;

      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere al menos un producto para crear la factura'
        });
      }

      if (!cliente || (!cliente.customer_id && !cliente.rut)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere cliente con customer_id o rut para crear factura'
        });
      }

      // Validar estructura de productos
      for (const p of productos) {
        if (!p.name || p.price === undefined || p.quantity === undefined) {
          return res.status(400).json({
            success: false,
            message: 'Cada producto debe tener name, price y quantity'
          });
        }
      }

      const resultado = await dteService.crearFactura(productos, cliente, {
        comment,
        type_payment_id
      });

      if (resultado.success) {
        res.json({
          success: true,
          data: {
            folio: resultado.folio,
            pdf_url: resultado.pdf_url,
            dte: resultado.data,
            provider: resultado.provider,
            modo_prueba: resultado.modo_prueba
          },
          message: `Factura electrónica creada exitosamente. Folio: ${resultado.folio}${resultado.modo_prueba ? ' (MODO PRUEBA)' : ''}`
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error || 'Error al crear factura',
          provider: resultado.provider
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/boletas - Listar boletas
  async listarBoletas(req: Request, res: Response, next: NextFunction) {
    try {
      const pagina = parseInt(req.query.page as string) || 1;

      const resultado = await dteService.obtenerDTEs(TipoDocumento.BOLETA_ELECTRONICA, pagina);

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/facturas - Listar facturas
  async listarFacturas(req: Request, res: Response, next: NextFunction) {
    try {
      const pagina = parseInt(req.query.page as string) || 1;

      const resultado = await dteService.obtenerDTEs(TipoDocumento.FACTURA_ELECTRONICA, pagina);

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/:id - Obtener detalle de un DTE
  async obtenerDTE(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const tipo = parseInt(req.query.tipo as string) || TipoDocumento.BOLETA_ELECTRONICA;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere ID del DTE'
        });
      }

      const resultado = await dteService.obtenerDTE(id, tipo);

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/productos - Obtener productos
  async obtenerProductos(req: Request, res: Response, next: NextFunction) {
    try {
      const pagina = parseInt(req.query.page as string) || 1;
      const codigo = req.query.codigo as string;

      let resultado;

      if (codigo) {
        resultado = await dteService.buscarProductoPorCodigo(codigo);
      } else {
        resultado = await dteService.obtenerProductos(pagina);
      }

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/clientes - Obtener clientes
  async obtenerClientes(req: Request, res: Response, next: NextFunction) {
    try {
      const pagina = parseInt(req.query.page as string) || 1;
      const rut = req.query.rut as string;

      let resultado;

      if (rut) {
        resultado = await dteService.buscarClientePorRut(rut);
      } else {
        resultado = await dteService.obtenerClientes(pagina);
      }

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider
        });
      } else {
        res.status(400).json({
          success: false,
          message: resultado.error
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/verificar - Verificar conexión
  async verificarConexion(req: Request, res: Response, next: NextFunction) {
    try {
      const resultado = await dteService.verificarConexion();

      if (resultado.success) {
        res.json({
          success: true,
          data: resultado.data,
          provider: resultado.provider,
          message: `Conexión con ${resultado.provider?.toUpperCase()} verificada exitosamente`
        });
      } else {
        res.status(503).json({
          success: false,
          message: resultado.error,
          provider: resultado.provider
        });
      }

    } catch (error) {
      next(error);
    }
  }

  // GET /api/dte/info - Información del proveedor actual
  async obtenerInfo(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          provider: dteService.getProvider(),
          test_mode: dteService.isTestMode(),
          message: `Usando ${dteService.getProvider().toUpperCase()}${dteService.isTestMode() ? ' en MODO PRUEBA' : ''}`
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
