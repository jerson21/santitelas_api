// src/services/DTEService.ts
// Servicio facade para facturación electrónica
// Permite cambiar entre Relbase y LibreDTE con una variable de entorno

import relbaseService, { TipoDocumento } from './RelbaseService';
import libreDTEService from './LibreDTEService';

// Re-exportar TipoDocumento
export { TipoDocumento };

export interface ProductoDTE {
  product_id?: number;
  name: string;
  code?: string;
  price: number;
  quantity: number;
  tax_affected: boolean;
  description?: string;
  unit_item?: string;
  discount?: number;
  discount_amount?: number;
}

export interface ClienteDTE {
  customer_id?: number;
  rut: string;
  name: string;
  giro?: string;
  address?: string;
  comuna?: string;
  city?: string;
  email?: string;
  phone?: string;
}

export interface EmisionOptions {
  comment?: string;
  type_payment_id?: number;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  forma_pago?: number;
  medio_pago?: string;
}

export interface DTEResponse {
  success: boolean;
  data?: any;
  error?: string;
  folio?: number;
  pdf_url?: string;
  xml_url?: string;
  track_id?: string;
  ted?: string;
  provider?: 'relbase' | 'libredte';
  modo_prueba?: boolean;
}

type DTEProvider = 'relbase' | 'libredte';

class DTEService {
  private provider: DTEProvider;

  constructor() {
    // Determinar proveedor desde variable de entorno
    const configuredProvider = (process.env.DTE_PROVIDER || 'relbase').toLowerCase();

    if (configuredProvider === 'libredte') {
      this.provider = 'libredte';
    } else {
      this.provider = 'relbase';
    }

    console.log(`📄 DTE Provider configurado: ${this.provider.toUpperCase()}`);
  }

  // Obtener proveedor actual
  getProvider(): DTEProvider {
    return this.provider;
  }

  // Verificar si está en modo prueba (solo aplica a LibreDTE)
  isTestMode(): boolean {
    if (this.provider === 'libredte') {
      return libreDTEService.estaEnModoPrueba();
    }
    return false;
  }

  // ========================================
  // MÉTODOS DE EMISIÓN
  // ========================================

  async crearBoleta(productos: ProductoDTE[], opciones?: EmisionOptions): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.crearBoleta(productos, {
        comment: opciones?.comment,
        fecha_emision: opciones?.fecha_emision,
        forma_pago: opciones?.forma_pago,
        medio_pago: opciones?.medio_pago
      });
      return { ...result, provider: 'libredte' };
    }

    // Relbase
    const result = await relbaseService.crearBoleta(productos, {
      comment: opciones?.comment,
      type_payment_id: opciones?.type_payment_id
    });
    return { ...result, provider: 'relbase' };
  }

  async crearFactura(
    productos: ProductoDTE[],
    cliente: ClienteDTE,
    opciones?: EmisionOptions
  ): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.crearFactura(
        productos,
        cliente,
        {
          comment: opciones?.comment,
          fecha_emision: opciones?.fecha_emision,
          fecha_vencimiento: opciones?.fecha_vencimiento,
          forma_pago: opciones?.forma_pago,
          medio_pago: opciones?.medio_pago
        }
      );
      return { ...result, provider: 'libredte' };
    }

    // Relbase
    const result = await relbaseService.crearFactura(
      productos,
      cliente,
      {
        comment: opciones?.comment,
        type_payment_id: opciones?.type_payment_id
      }
    );
    return { ...result, provider: 'relbase' };
  }

  // ========================================
  // MÉTODOS DE CONSULTA
  // ========================================

  async obtenerDTEs(tipo: number, pagina: number = 1): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.obtenerDTEs(tipo, pagina);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.obtenerDTEs(tipo, pagina);
    return { ...result, provider: 'relbase' };
  }

  async obtenerDTE(folio: number, tipo: number): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.obtenerDTE(folio, tipo);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.obtenerDTE(folio, tipo);
    return { ...result, provider: 'relbase' };
  }

  async obtenerPDF(folio: number, tipo: number): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.obtenerPDF(folio, tipo);
      return { ...result, provider: 'libredte' };
    }

    // Relbase no tiene método separado para PDF, viene en obtenerDTE
    const result = await relbaseService.obtenerDTE(folio, tipo);
    return { ...result, provider: 'relbase' };
  }

  // ========================================
  // MÉTODOS DE CATÁLOGO
  // ========================================

  async obtenerProductos(pagina: number = 1): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.obtenerProductos(pagina);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.obtenerProductos(pagina);
    return { ...result, provider: 'relbase' };
  }

  async buscarProductoPorCodigo(codigo: string): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.buscarProductoPorCodigo(codigo);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.buscarProductoPorCodigo(codigo);
    return { ...result, provider: 'relbase' };
  }

  async obtenerClientes(pagina: number = 1): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.obtenerClientes(pagina);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.obtenerClientes(pagina);
    return { ...result, provider: 'relbase' };
  }

  async buscarClientePorRut(rut: string): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.buscarClientePorRut(rut);
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.buscarClientePorRut(rut);
    return { ...result, provider: 'relbase' };
  }

  // ========================================
  // VERIFICACIÓN
  // ========================================

  async verificarConexion(): Promise<DTEResponse> {
    if (this.provider === 'libredte') {
      const result = await libreDTEService.verificarConexion();
      return { ...result, provider: 'libredte' };
    }

    const result = await relbaseService.verificarConexion();
    return { ...result, provider: 'relbase' };
  }
}

// Exportar instancia singleton
export const dteService = new DTEService();
export default dteService;
