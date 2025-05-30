// src/middlewares/validators.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Función helper para validar esquemas
const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }
    
    next();
  };
};

// === ESQUEMAS DE VALIDACIÓN COMPLETOS ===

const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50)
    .messages({
      'string.empty': 'El usuario es requerido',
      'string.min': 'El usuario debe tener al menos 3 caracteres',
      'string.max': 'El usuario no puede tener más de 50 caracteres'
    }),
  password: Joi.string().required().min(3).max(255)
    .messages({
      'string.empty': 'La contraseña es requerida',
      'string.min': 'La contraseña debe tener al menos 3 caracteres'
    })
});

const createUsuarioSchema = Joi.object({
  usuario: Joi.string().required().min(3).max(50)
    .messages({
      'string.empty': 'El usuario es requerido',
      'string.min': 'El usuario debe tener al menos 3 caracteres'
    }),
  password: Joi.string().required().min(3).max(255)
    .messages({
      'string.empty': 'La contraseña es requerida',
      'string.min': 'La contraseña debe tener al menos 3 caracteres'
    }),
  nombre_completo: Joi.string().required().min(3).max(100)
    .messages({
      'string.empty': 'El nombre completo es requerido'
    }),
  id_rol: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'El rol debe ser un número',
      'number.positive': 'El rol debe ser válido'
    }),
  email: Joi.string().email().allow(null, '')
    .messages({
      'string.email': 'El email debe tener un formato válido'
    }),
  telefono: Joi.string().max(20).allow(null, ''),
  activo: Joi.boolean().default(true)
});

const createProductoSchema = Joi.object({
  codigo: Joi.string().max(50).allow(null, ''),
  nombre: Joi.string().required().min(2).max(100)
    .messages({
      'string.empty': 'El nombre del producto es requerido'
    }),
  descripcion: Joi.string().allow(null, ''),
  color: Joi.string().max(30).allow(null, ''),
  id_categoria: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'La categoría debe ser un número',
      'number.positive': 'Debe seleccionar una categoría válida'
    }),
  // MÚLTIPLES PRECIOS REQUERIDOS
  precio_sin_iva: Joi.number().positive().required()
    .messages({
      'number.base': 'El precio sin IVA debe ser un número',
      'number.positive': 'El precio sin IVA debe ser mayor a 0'
    }),
  precio_con_iva: Joi.number().positive().required()
    .messages({
      'number.base': 'El precio con IVA debe ser un número',
      'number.positive': 'El precio con IVA debe ser mayor a 0'
    }),
  precio_boleta: Joi.number().positive().required()
    .messages({
      'number.base': 'El precio para boleta debe ser un número',
      'number.positive': 'El precio para boleta debe ser mayor a 0'
    }),
  precio_factura: Joi.number().positive().required()
    .messages({
      'number.base': 'El precio para factura debe ser un número',
      'number.positive': 'El precio para factura debe ser mayor a 0'
    }),
  precio_costo: Joi.number().min(0).default(0),
  stock_minimo_total: Joi.number().min(0).default(0),
  unidad_medida: Joi.string().valid('metro', 'unidad', 'kilogramo').default('metro'),
  activo: Joi.boolean().default(true)
});

const createPedidoSchema = Joi.object({
  id_vendedor: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'El vendedor debe ser un número',
      'number.positive': 'Debe seleccionar un vendedor válido'
    }),
  nombre_cliente: Joi.string().max(100).allow(null, ''),
  telefono_cliente: Joi.string().max(20).allow(null, ''),
  observaciones: Joi.string().allow(null, '')
});

const addItemPedidoSchema = Joi.object({
  id_producto: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'El producto debe ser un número',
      'number.positive': 'Debe seleccionar un producto válido'
    }),
  cantidad: Joi.number().positive().required()
    .messages({
      'number.base': 'La cantidad debe ser un número',
      'number.positive': 'La cantidad debe ser mayor a 0'
    }),
  tipo_precio: Joi.string().valid('sin_iva', 'con_iva', 'boleta', 'factura').required()
    .messages({
      'any.only': 'El tipo de precio debe ser: sin_iva, con_iva, boleta o factura'
    }),
  observaciones: Joi.string().allow(null, '')
});

const createVentaSchema = Joi.object({
  id_pedido: Joi.number().integer().positive().required(),
  id_turno: Joi.number().integer().positive().required(),
  id_tipo_documento: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'El tipo de documento debe ser un número',
      'number.positive': 'Debe seleccionar un tipo de documento válido'
    }),
  id_bodega: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'La bodega debe ser un número',
      'number.positive': 'Debe seleccionar una bodega válida'
    }),
  nombre_cliente: Joi.string().max(100).allow(null, ''),
  rut_cliente: Joi.string().max(20).allow(null, ''),
  direccion_cliente: Joi.string().allow(null, ''),
  telefono_cliente: Joi.string().max(20).allow(null, ''),
  observaciones: Joi.string().allow(null, ''),
  pagos: Joi.array().items(
    Joi.object({
      id_metodo_pago: Joi.number().integer().positive().required(),
      monto: Joi.number().positive().required(),
      referencia: Joi.string().max(100).allow(null, '')
    })
  ).min(1).required()
    .messages({
      'array.min': 'Debe incluir al menos un método de pago'
    })
});

const abrirTurnoSchema = Joi.object({
  id_caja: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'La caja debe ser un número',
      'number.positive': 'Debe seleccionar una caja válida'
    }),
  monto_inicial: Joi.number().min(0).required()
    .messages({
      'number.base': 'El monto inicial debe ser un número',
      'number.min': 'El monto inicial no puede ser negativo'
    }),
  observaciones_apertura: Joi.string().allow(null, '')
});

const cerrarTurnoSchema = Joi.object({
  monto_real_cierre: Joi.number().min(0).required()
    .messages({
      'number.base': 'El monto de cierre debe ser un número',
      'number.min': 'El monto de cierre no puede ser negativo'
    }),
  observaciones_cierre: Joi.string().allow(null, '')
});

const arqueoSchema = Joi.object({
  billetes_20000: Joi.number().integer().min(0).default(0),
  billetes_10000: Joi.number().integer().min(0).default(0),
  billetes_5000: Joi.number().integer().min(0).default(0),
  billetes_2000: Joi.number().integer().min(0).default(0),
  billetes_1000: Joi.number().integer().min(0).default(0),
  monedas_500: Joi.number().integer().min(0).default(0),
  monedas_100: Joi.number().integer().min(0).default(0),
  monedas_50: Joi.number().integer().min(0).default(0),
  monedas_10: Joi.number().integer().min(0).default(0),
  observaciones: Joi.string().allow(null, '')
});

const transferirStockSchema = Joi.object({
  id_producto: Joi.number().integer().positive().required()
    .messages({
      'number.positive': 'Debe seleccionar un producto válido'
    }),
  id_bodega_origen: Joi.number().integer().positive().required()
    .messages({
      'number.positive': 'Debe seleccionar una bodega origen válida'
    }),
  id_bodega_destino: Joi.number().integer().positive().required()
    .messages({
      'number.positive': 'Debe seleccionar una bodega destino válida'
    }),
  cantidad: Joi.number().positive().required()
    .messages({
      'number.positive': 'La cantidad debe ser mayor a 0'
    }),
  motivo: Joi.string().required().min(5).max(100)
    .messages({
      'string.empty': 'El motivo es requerido',
      'string.min': 'El motivo debe tener al menos 5 caracteres'
    })
});

const ajustarStockSchema = Joi.object({
  id_producto: Joi.number().integer().positive().required(),
  id_bodega: Joi.number().integer().positive().required(),
  cantidad_nueva: Joi.number().min(0).required()
    .messages({
      'number.min': 'La cantidad no puede ser negativa'
    }),
  motivo: Joi.string().required().min(5).max(100)
    .messages({
      'string.empty': 'El motivo del ajuste es requerido'
    })
});

const refreshSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'string.empty': 'El token es requerido'
    })
});

// === EXPORTAR VALIDADORES ===

export const validateLogin = validate(loginSchema);
export const validateCreateUsuario = validate(createUsuarioSchema);
export const validateCreateProducto = validate(createProductoSchema);
export const validateCreatePedido = validate(createPedidoSchema);
export const validateAddItemPedido = validate(addItemPedidoSchema);
export const validateCreateVenta = validate(createVentaSchema);
export const validateTransferirStock = validate(transferirStockSchema);
export const validateAjustarStock = validate(ajustarStockSchema);
export const validateAbrirTurno = validate(abrirTurnoSchema);
export const validateCerrarTurno = validate(cerrarTurnoSchema);
export const validateArqueo = validate(arqueoSchema);
export const validateRefresh = validate(refreshSchema);