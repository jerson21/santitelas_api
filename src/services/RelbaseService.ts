// src/services/RelbaseService.ts
// Servicio para integración con API de Relbase (facturación electrónica Chile)

import * as dotenv from 'dotenv';
dotenv.config();

// Tipos de documento SII
export enum TipoDocumento {
  FACTURA_ELECTRONICA = 33,
  FACTURA_EXENTA = 34,
  BOLETA_ELECTRONICA = 39,
  GUIA_DESPACHO = 52,
  NOTA_CREDITO = 61,
  NOTA_DEBITO = 56,
  NOTA_VENTA = 1001
}

interface ProductoDTE {
  product_id?: number;
  name: string;
  code?: string;
  price: number;
  quantity: number;
  tax_affected: boolean;
  description?: string;
  unit_item?: string;
}

interface ClienteDTE {
  customer_id?: number;
  rut?: string;
  name?: string;
  address?: string;
  commune_id?: number;
  city_id?: number;
}

interface RelbaseResponse {
  success: boolean;
  data?: any;
  error?: string;
  folio?: number;
  pdf_url?: string;
  modo_prueba?: boolean;
}

// Configuración de Relbase para esta cuenta
const PRODUCTO_GENERICO_ID = 7573600;  // Producto genérico para items sin registrar
const BODEGA_ID = 3480;                 // Bodega principal (obligatorio)
const FORMA_PAGO_EFECTIVO_ID = 15940;   // Forma de pago por defecto (Efectivo)

class RelbaseService {
  private baseURL: string;
  private companyToken: string;
  private userToken: string;
  private modoPrueba: boolean;
  private folioSimuladoBoleta: number = 99000; // Folio simulado para pruebas
  private folioSimuladoFactura: number = 9900;

  constructor() {
    this.baseURL = 'https://api.relbase.cl/api/v1';
    this.companyToken = process.env.RELBASE_COMPANY_TOKEN || '';
    this.userToken = process.env.RELBASE_USER_TOKEN || '';

    // MODO PRUEBA: false = emite real, true = simula sin llamar a Relbase
    this.modoPrueba = process.env.RELBASE_MODO_PRUEBA === 'true';

    if (this.modoPrueba) {
      console.log('⚠️  RELBASE EN MODO PRUEBA - No se emitirán documentos reales');
    } else {
      console.log('✅ RELBASE EN MODO PRODUCCIÓN - Los documentos se emitirán al SII');
    }

    if (!this.companyToken || !this.userToken) {
      console.warn('ADVERTENCIA: Tokens de Relbase no configurados. Configure RELBASE_COMPANY_TOKEN y RELBASE_USER_TOKEN en .env');
    }
  }

  // Verificar si está en modo prueba
  public estaEnModoPrueba(): boolean {
    return this.modoPrueba;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'company': this.companyToken,
      'authorization': this.userToken
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    });

    const data: any = await response.json();

    if (!response.ok) {
      // Relbase devuelve errores en data.meta.message o data.error
      const errorMessage = data.meta?.message || data.error || `Error ${response.status}: ${response.statusText}`;
      console.error('❌ Error Relbase:', errorMessage);
      throw new Error(errorMessage);
    }

    return data;
  }

  // Obtener fecha actual en formato YYYY-MM-DD
  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Simular respuesta de boleta para modo prueba
  private simularBoleta(productos: ProductoDTE[]): RelbaseResponse {
    this.folioSimuladoBoleta++;
    const total = productos.reduce((sum, p) => sum + (p.price * p.quantity), 0);

    console.log(`🧪 SIMULACIÓN: Boleta N° ${this.folioSimuladoBoleta} - Total: $${total}`);

    return {
      success: true,
      modo_prueba: true,
      folio: this.folioSimuladoBoleta,
      pdf_url: undefined,
      data: {
        id: Date.now(),
        folio: this.folioSimuladoBoleta,
        type_document: 39,
        type_document_name: 'BOLETA ELECTRÓNICA (PRUEBA)',
        amount_total: total,
        sii_status: 'simulado',
        sii_status_name: 'Modo Prueba',
        created_at: new Date().toISOString()
      }
    };
  }

  // Simular respuesta de factura para modo prueba
  private simularFactura(productos: ProductoDTE[], cliente: ClienteDTE): RelbaseResponse {
    this.folioSimuladoFactura++;
    const total = productos.reduce((sum, p) => sum + (p.price * p.quantity), 0);

    console.log(`🧪 SIMULACIÓN: Factura N° ${this.folioSimuladoFactura} - Total: $${total}`);

    return {
      success: true,
      modo_prueba: true,
      folio: this.folioSimuladoFactura,
      pdf_url: undefined,
      data: {
        id: Date.now(),
        folio: this.folioSimuladoFactura,
        type_document: 33,
        type_document_name: 'FACTURA ELECTRÓNICA (PRUEBA)',
        amount_total: total,
        customer_rut: cliente.rut || 'N/A',
        sii_status: 'simulado',
        sii_status_name: 'Modo Prueba',
        created_at: new Date().toISOString()
      }
    };
  }

  // Crear Boleta Electrónica (tipo 39)
  async crearBoleta(productos: ProductoDTE[], opciones?: {
    comment?: string;
    type_payment_id?: number;
  }): Promise<RelbaseResponse> {
    // Si está en modo prueba, simular respuesta
    if (this.modoPrueba) {
      return this.simularBoleta(productos);
    }

    try {
      const today = this.getTodayDate();

      const body = {
        type_document: TipoDocumento.BOLETA_ELECTRONICA,
        start_date: today,
        end_date: today,
        // Campos obligatorios para Relbase
        ware_house_id: BODEGA_ID,
        type_payment_id: opciones?.type_payment_id || FORMA_PAGO_EFECTIVO_ID,
        products: productos.map(p => ({
          // Usar product_id del producto o el genérico si no está registrado
          product_id: (p.product_id && p.product_id > 0) ? p.product_id : PRODUCTO_GENERICO_ID,
          price: p.price,
          quantity: p.quantity,
          tax_affected: p.tax_affected !== false, // Por defecto true
          description: p.name || p.description || '', // Usamos name como description
          unit_item: p.unit_item || 'UNID'
        })),
        ...(opciones?.comment && { comment: opciones.comment })
      };

      console.log('📤 Enviando boleta a Relbase:', JSON.stringify(body, null, 2));

      const response = await this.request('/dtes', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      console.log(`✅ BOLETA EMITIDA: Folio ${response.data?.folio}`);

      return {
        success: true,
        modo_prueba: false,
        data: response.data,
        folio: response.data?.folio,
        pdf_url: response.data?.pdf_file?.url
      };

    } catch (error: any) {
      console.error('Error creando boleta en Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Crear Factura Electrónica (tipo 33)
  async crearFactura(
    productos: ProductoDTE[],
    cliente: ClienteDTE,
    opciones?: {
      comment?: string;
      type_payment_id?: number;
    }
  ): Promise<RelbaseResponse> {
    // Si está en modo prueba, simular respuesta
    if (this.modoPrueba) {
      return this.simularFactura(productos, cliente);
    }

    try {
      const today = this.getTodayDate();

      // Para factura se requiere customer_id o datos del cliente
      if (!cliente.customer_id && !cliente.rut) {
        throw new Error('Se requiere customer_id o rut del cliente para factura');
      }

      const body = {
        type_document: TipoDocumento.FACTURA_ELECTRONICA,
        start_date: today,
        end_date: today,
        // Campos obligatorios para Relbase
        ware_house_id: BODEGA_ID,
        type_payment_id: opciones?.type_payment_id || FORMA_PAGO_EFECTIVO_ID,
        products: productos.map(p => ({
          // Usar product_id del producto o el genérico si no está registrado
          product_id: (p.product_id && p.product_id > 0) ? p.product_id : PRODUCTO_GENERICO_ID,
          price: p.price,
          quantity: p.quantity,
          tax_affected: p.tax_affected !== false,
          description: p.name || p.description || '', // Usamos name como description
          unit_item: p.unit_item || 'UNID'
        })),
        ...(cliente.customer_id && { customer_id: cliente.customer_id }),
        ...(cliente.address && { address: cliente.address }),
        ...(cliente.commune_id && { commune_id: cliente.commune_id }),
        ...(cliente.city_id && { city_id: cliente.city_id }),
        ...(opciones?.comment && { comment: opciones.comment })
      };

      const response = await this.request('/dtes', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      console.log(`✅ FACTURA EMITIDA: Folio ${response.data?.folio}`);

      return {
        success: true,
        modo_prueba: false,
        data: response.data,
        folio: response.data?.folio,
        pdf_url: response.data?.pdf_file?.url
      };

    } catch (error: any) {
      console.error('Error creando factura en Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener DTEs (boletas o facturas)
  async obtenerDTEs(tipo: TipoDocumento, pagina: number = 1): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/dtes?type_document=${tipo}&page=${pagina}`);

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('Error obteniendo DTEs de Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener detalle de un DTE
  async obtenerDTE(id: number, tipo: TipoDocumento): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/dtes/${id}?type_document=${tipo}`);

      return {
        success: true,
        data: response.data,
        folio: response.data?.folio,
        pdf_url: response.data?.pdf_file?.url
      };

    } catch (error: any) {
      console.error('Error obteniendo DTE de Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener productos de Relbase
  async obtenerProductos(pagina: number = 1): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/productos?page=${pagina}`);

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('Error obteniendo productos de Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Buscar producto por código
  async buscarProductoPorCodigo(codigo: string): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/productos?code=${encodeURIComponent(codigo)}`);

      return {
        success: true,
        data: response.data?.products?.[0] || null
      };

    } catch (error: any) {
      console.error('Error buscando producto en Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener clientes de Relbase
  async obtenerClientes(pagina: number = 1): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/clientes?page=${pagina}`);

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('Error obteniendo clientes de Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Buscar cliente por RUT
  async buscarClientePorRut(rut: string): Promise<RelbaseResponse> {
    try {
      const response = await this.request(`/clientes?rut=${encodeURIComponent(rut)}`);

      return {
        success: true,
        data: response.data?.customers?.[0] || null
      };

    } catch (error: any) {
      console.error('Error buscando cliente en Relbase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verificar conexión con Relbase
  async verificarConexion(): Promise<RelbaseResponse> {
    try {
      // Intentar obtener productos como prueba de conexión
      const response = await this.request('/productos?page=1');

      return {
        success: true,
        data: {
          connected: true,
          message: 'Conexión exitosa con Relbase',
          modo_prueba: this.modoPrueba
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Error de conexión: ${error.message}`
      };
    }
  }
}

// Exportar instancia singleton
export const relbaseService = new RelbaseService();
export default relbaseService;
