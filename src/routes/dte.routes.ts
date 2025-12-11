// src/routes/dte.routes.ts
// Rutas para emisión de documentos tributarios electrónicos
// Soporta Relbase y LibreDTE según DTE_PROVIDER

import { Router } from 'express';
import { DTEController } from '../controllers/DTEController';

const router = Router();
const dteController = new DTEController();

/**
 * @openapi
 * tags:
 *   - name: dte
 *     description: Documentos Tributarios Electrónicos (Relbase/LibreDTE)
 */

/**
 * @openapi
 * /dte/info:
 *   get:
 *     summary: Obtener información del proveedor DTE actual
 *     tags:
 *       - dte
 *     responses:
 *       '200':
 *         description: Información del proveedor
 */
router.get('/info', dteController.obtenerInfo.bind(dteController));

/**
 * @openapi
 * /dte/verificar:
 *   get:
 *     summary: Verificar conexión con el proveedor DTE
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Conexión exitosa
 *       '503':
 *         description: Error de conexión con Relbase
 */
router.get('/verificar', dteController.verificarConexion.bind(dteController));

/**
 * @openapi
 * /dte/boleta:
 *   post:
 *     summary: Crear boleta electrónica
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productos
 *             properties:
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - price
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: number
 *                       description: ID del producto en Relbase (opcional)
 *                     name:
 *                       type: string
 *                       description: Nombre del producto
 *                     code:
 *                       type: string
 *                       description: Código del producto
 *                     price:
 *                       type: number
 *                       description: Precio con IVA incluido
 *                     quantity:
 *                       type: number
 *                       description: Cantidad
 *                     tax_affected:
 *                       type: boolean
 *                       description: Afecto a IVA (default true)
 *               comment:
 *                 type: string
 *                 description: Comentario opcional
 *               type_payment_id:
 *                 type: number
 *                 description: ID tipo de pago en Relbase
 *     responses:
 *       '200':
 *         description: Boleta creada exitosamente
 *       '400':
 *         description: Error en datos de entrada o error de Relbase
 */
router.post('/boleta', dteController.crearBoleta.bind(dteController));

/**
 * @openapi
 * /dte/factura:
 *   post:
 *     summary: Crear factura electrónica
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productos
 *               - cliente
 *             properties:
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - price
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: number
 *                     name:
 *                       type: string
 *                     code:
 *                       type: string
 *                     price:
 *                       type: number
 *                     quantity:
 *                       type: number
 *                     tax_affected:
 *                       type: boolean
 *               cliente:
 *                 type: object
 *                 properties:
 *                   customer_id:
 *                     type: number
 *                     description: ID cliente en Relbase
 *                   rut:
 *                     type: string
 *                     description: RUT del cliente
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   commune_id:
 *                     type: number
 *                   city_id:
 *                     type: number
 *               comment:
 *                 type: string
 *               type_payment_id:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Factura creada exitosamente
 *       '400':
 *         description: Error en datos de entrada o error de Relbase
 */
router.post('/factura', dteController.crearFactura.bind(dteController));

/**
 * @openapi
 * /dte/boletas:
 *   get:
 *     summary: Listar boletas electrónicas
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       '200':
 *         description: Lista de boletas
 */
router.get('/boletas', dteController.listarBoletas.bind(dteController));

/**
 * @openapi
 * /dte/facturas:
 *   get:
 *     summary: Listar facturas electrónicas
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       '200':
 *         description: Lista de facturas
 */
router.get('/facturas', dteController.listarFacturas.bind(dteController));

/**
 * @openapi
 * /dte/{id}:
 *   get:
 *     summary: Obtener detalle de un DTE
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: integer
 *           default: 39
 *         description: "39=boleta, 33=factura"
 *     responses:
 *       '200':
 *         description: Detalle del DTE
 */
router.get('/:id', dteController.obtenerDTE.bind(dteController));

/**
 * @openapi
 * /dte/productos:
 *   get:
 *     summary: Obtener productos de Relbase
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: codigo
 *         in: query
 *         schema:
 *           type: string
 *         description: Buscar por código
 *     responses:
 *       '200':
 *         description: Lista de productos
 */
router.get('/productos', dteController.obtenerProductos.bind(dteController));

/**
 * @openapi
 * /dte/clientes:
 *   get:
 *     summary: Obtener clientes de Relbase
 *     tags:
 *       - dte
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: rut
 *         in: query
 *         schema:
 *           type: string
 *         description: Buscar por RUT
 *     responses:
 *       '200':
 *         description: Lista de clientes
 */
router.get('/clientes', dteController.obtenerClientes.bind(dteController));

export default router;
