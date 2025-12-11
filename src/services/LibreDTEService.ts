// src/services/LibreDTEService.ts
// Servicio para integración con LibreDTE Community (facturación electrónica Chile)
// Este servicio replica la interfaz de RelbaseService para facilitar la migración

import * as dotenv from 'dotenv';
dotenv.config();

// Tipos de documento SII (mismos que RelbaseService)
export enum TipoDocumento {
  FACTURA_ELECTRONICA = 33,
  FACTURA_EXENTA = 34,
  BOLETA_ELECTRONICA = 39,
  GUIA_DESPACHO = 52,
  NOTA_CREDITO = 61,
  NOTA_DEBITO = 56,
  NOTA_VENTA = 1001
}

// Interfaces compatibles con RelbaseService
export interface ProductoDTE {
  product_id?: number;      // ID interno (no requerido por LibreDTE)
  name: string;             // Nombre del producto
  code?: string;            // Código interno del producto
  price: number;            // Precio unitario (neto o bruto según configuración)
  quantity: number;         // Cantidad
  tax_affected: boolean;    // true = afecto a IVA, false = exento
  description?: string;     // Descripción adicional
  unit_item?: string;       // Unidad de medida (UN, MT, KG, etc.)
  discount?: number;        // Descuento en porcentaje (0-100)
  discount_amount?: number; // Descuento en monto fijo
}

export interface ClienteDTE {
  customer_id?: number;     // ID interno (no requerido por LibreDTE)
  rut: string;              // RUT del cliente (obligatorio para factura)
  name: string;             // Razón social
  giro?: string;            // Giro comercial
  address?: string;         // Dirección
  comuna?: string;          // Comuna
  city?: string;            // Ciudad
  email?: string;           // Email para envío de DTE
  phone?: string;           // Teléfono
}

export interface EmisionDTEOptions {
  comment?: string;         // Comentario o glosa adicional
  fecha_emision?: string;   // Fecha de emisión (YYYY-MM-DD), default: hoy
  fecha_vencimiento?: string; // Fecha vencimiento (solo factura)
  forma_pago?: number;      // 1=Contado, 2=Crédito
  medio_pago?: string;      // EF=Efectivo, TC=Tarjeta, etc.
  referencia?: {            // Para notas de crédito/débito
    tipo_doc: number;
    folio: number;
    fecha: string;
    razon: string;
  };
}

export interface LibreDTEResponse {
  success: boolean;
  data?: any;
  error?: string;
  folio?: number;
  pdf_url?: string;
  xml_url?: string;
  track_id?: string;        // ID de seguimiento SII
  ted?: string;             // Timbre electrónico
  modo_prueba?: boolean;
}

// Estructura del DTE según LibreDTE
interface DTEData {
  Encabezado: {
    IdDoc: {
      TipoDTE: number;
      Folio?: number;
      FchEmis: string;
      FchVenc?: string;
      FmaPago?: number;
      MedioPago?: string;
    };
    Emisor: {
      RUTEmisor: string;
      RznSoc: string;
      GiroEmis: string;
      Acteco?: number;
      DirOrigen: string;
      CmnaOrigen: string;
      CdgSIISucur?: number;
    };
    Receptor: {
      RUTRecep: string;
      RznSocRecep: string;
      GiroRecep?: string;
      DirRecep?: string;
      CmnaRecep?: string;
      CiudadRecep?: string;
      CorreoRecep?: string;
    };
    Totales?: {
      MntNeto?: number;
      MntExe?: number;
      IVA?: number;
      MntTotal: number;
    };
  };
  Detalle: Array<{
    NroLinDet: number;
    CdgItem?: Array<{ TpoCodigo: string; VlrCodigo: string }>;
    NmbItem: string;
    DscItem?: string;
    QtyItem: number;
    UnmdItem?: string;
    PrcItem: number;
    DescuentoPct?: number;
    DescuentoMonto?: number;
    MontoItem: number;
    IndExe?: number;
  }>;
  Referencia?: Array<{
    NroLinRef: number;
    TpoDocRef: number;
    FolioRef: number;
    FchRef: string;
    RazonRef: string;
  }>;
}

class LibreDTEService {
  private baseURL: string;
  private apiKey: string;
  private rutEmpresa: string;
  private modoPrueba: boolean;
  private ambiente: 'produccion' | 'certificacion';
  private folioSimuladoBoleta: number = 99000;
  private folioSimuladoFactura: number = 9900;

  // Datos del emisor (empresa)
  private emisor: {
    rut: string;
    razon_social: string;
    giro: string;
    acteco: number;
    direccion: string;
    comuna: string;
  };

  constructor() {
    // URL del servicio LibreDTE (contenedor Docker local)
    this.baseURL = process.env.LIBREDTE_API_URL || 'http://libredte-app:80/api';
    this.apiKey = process.env.LIBREDTE_API_KEY || '';
    this.rutEmpresa = process.env.LIBREDTE_RUT_EMPRESA || process.env.RELBASE_RUT_EMPRESA || '';

    // Ambiente: produccion o certificacion (pruebas SII)
    this.ambiente = (process.env.LIBREDTE_AMBIENTE as 'produccion' | 'certificacion') || 'certificacion';

    // MODO PRUEBA: false = emite real, true = simula sin llamar a LibreDTE
    this.modoPrueba = process.env.LIBREDTE_MODO_PRUEBA === 'true';

    // Datos del emisor
    this.emisor = {
      rut: this.rutEmpresa,
      razon_social: process.env.LIBREDTE_RAZON_SOCIAL || 'SANTI TELAS LIMITADA',
      giro: process.env.LIBREDTE_GIRO || 'VENTA AL POR MENOR DE TEXTILES',
      acteco: parseInt(process.env.LIBREDTE_ACTECO || '472301'),
      direccion: process.env.LIBREDTE_DIRECCION || '',
      comuna: process.env.LIBREDTE_COMUNA || ''
    };

    if (this.modoPrueba) {
      console.log('⚠️  LIBREDTE EN MODO PRUEBA - No se emitirán documentos reales');
    } else {
      console.log(`✅ LIBREDTE EN MODO ${this.ambiente.toUpperCase()} - Conectando a ${this.baseURL}`);
    }
  }

  // Verificar si está en modo prueba
  public estaEnModoPrueba(): boolean {
    return this.modoPrueba;
  }

  // Obtener ambiente actual
  public getAmbiente(): string {
    return this.ambiente;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      });

      const data: any = await response.json();

      if (!response.ok) {
        const errorMessage = data.message || data.error || `Error ${response.status}: ${response.statusText}`;
        console.error('❌ Error LibreDTE:', errorMessage);
        throw new Error(errorMessage);
      }

      return data;

    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('No se pudo conectar con LibreDTE. Verifica que el contenedor esté corriendo.');
      }
      throw error;
    }
  }

  // Obtener fecha actual en formato YYYY-MM-DD
  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Calcular totales del documento
  private calcularTotales(productos: ProductoDTE[]): { neto: number; exento: number; iva: number; total: number } {
    let neto = 0;
    let exento = 0;

    for (const p of productos) {
      const subtotal = p.price * p.quantity;

      // Aplicar descuento si existe
      let montoFinal = subtotal;
      if (p.discount && p.discount > 0) {
        montoFinal = subtotal * (1 - p.discount / 100);
      } else if (p.discount_amount && p.discount_amount > 0) {
        montoFinal = subtotal - p.discount_amount;
      }

      if (p.tax_affected) {
        neto += montoFinal;
      } else {
        exento += montoFinal;
      }
    }

    const iva = Math.round(neto * 0.19);
    const total = Math.round(neto + iva + exento);

    return { neto: Math.round(neto), exento: Math.round(exento), iva, total };
  }

  // Construir estructura de detalle
  private buildDetalle(productos: ProductoDTE[]): DTEData['Detalle'] {
    return productos.map((p, index) => {
      const subtotal = p.price * p.quantity;
      let montoItem = subtotal;

      if (p.discount && p.discount > 0) {
        montoItem = subtotal * (1 - p.discount / 100);
      } else if (p.discount_amount && p.discount_amount > 0) {
        montoItem = subtotal - p.discount_amount;
      }

      return {
        NroLinDet: index + 1,
        ...(p.code && {
          CdgItem: [{ TpoCodigo: 'INT1', VlrCodigo: p.code }]
        }),
        NmbItem: p.name.substring(0, 80), // Máximo 80 caracteres
        ...(p.description && { DscItem: p.description.substring(0, 1000) }),
        QtyItem: p.quantity,
        UnmdItem: p.unit_item || 'UN',
        PrcItem: Math.round(p.price),
        ...(p.discount && p.discount > 0 && { DescuentoPct: p.discount }),
        ...(p.discount_amount && p.discount_amount > 0 && { DescuentoMonto: p.discount_amount }),
        MontoItem: Math.round(montoItem),
        ...(!p.tax_affected && { IndExe: 1 }) // Indicador de exento
      };
    });
  }

  // Simular respuesta de boleta para modo prueba
  private simularBoleta(productos: ProductoDTE[]): LibreDTEResponse {
    this.folioSimuladoBoleta++;
    const totales = this.calcularTotales(productos);

    console.log(`🧪 SIMULACIÓN LIBREDTE: Boleta N° ${this.folioSimuladoBoleta} - Total: $${totales.total}`);

    return {
      success: true,
      modo_prueba: true,
      folio: this.folioSimuladoBoleta,
      pdf_url: undefined,
      xml_url: undefined,
      track_id: `SIM-${Date.now()}`,
      data: {
        folio: this.folioSimuladoBoleta,
        tipo_dte: TipoDocumento.BOLETA_ELECTRONICA,
        tipo_dte_nombre: 'BOLETA ELECTRÓNICA (PRUEBA)',
        monto_neto: totales.neto,
        monto_exento: totales.exento,
        iva: totales.iva,
        monto_total: totales.total,
        estado_sii: 'simulado',
        fecha_emision: this.getTodayDate()
      }
    };
  }

  // Simular respuesta de factura para modo prueba
  private simularFactura(productos: ProductoDTE[], cliente: ClienteDTE): LibreDTEResponse {
    this.folioSimuladoFactura++;
    const totales = this.calcularTotales(productos);

    console.log(`🧪 SIMULACIÓN LIBREDTE: Factura N° ${this.folioSimuladoFactura} - Total: $${totales.total}`);

    return {
      success: true,
      modo_prueba: true,
      folio: this.folioSimuladoFactura,
      pdf_url: undefined,
      xml_url: undefined,
      track_id: `SIM-${Date.now()}`,
      data: {
        folio: this.folioSimuladoFactura,
        tipo_dte: TipoDocumento.FACTURA_ELECTRONICA,
        tipo_dte_nombre: 'FACTURA ELECTRÓNICA (PRUEBA)',
        rut_receptor: cliente.rut,
        razon_social_receptor: cliente.name,
        monto_neto: totales.neto,
        monto_exento: totales.exento,
        iva: totales.iva,
        monto_total: totales.total,
        estado_sii: 'simulado',
        fecha_emision: this.getTodayDate()
      }
    };
  }

  // ========================================
  // MÉTODOS PÚBLICOS (Compatible con RelbaseService)
  // ========================================

  /**
   * Crear Boleta Electrónica (tipo 39)
   * Las boletas no requieren datos del receptor
   */
  async crearBoleta(productos: ProductoDTE[], opciones?: EmisionDTEOptions): Promise<LibreDTEResponse> {
    // Si está en modo prueba, simular respuesta
    if (this.modoPrueba) {
      return this.simularBoleta(productos);
    }

    try {
      const fecha = opciones?.fecha_emision || this.getTodayDate();
      const totales = this.calcularTotales(productos);

      // Estructura del DTE para LibreDTE
      const dte: DTEData = {
        Encabezado: {
          IdDoc: {
            TipoDTE: TipoDocumento.BOLETA_ELECTRONICA,
            FchEmis: fecha,
            FmaPago: opciones?.forma_pago || 1, // 1 = Contado
            ...(opciones?.medio_pago && { MedioPago: opciones.medio_pago })
          },
          Emisor: {
            RUTEmisor: this.emisor.rut,
            RznSoc: this.emisor.razon_social,
            GiroEmis: this.emisor.giro,
            Acteco: this.emisor.acteco,
            DirOrigen: this.emisor.direccion,
            CmnaOrigen: this.emisor.comuna
          },
          Receptor: {
            RUTRecep: '66666666-6', // RUT genérico para boletas sin identificar receptor
            RznSocRecep: 'CLIENTE GENERICO'
          },
          Totales: {
            MntNeto: totales.neto,
            ...(totales.exento > 0 && { MntExe: totales.exento }),
            IVA: totales.iva,
            MntTotal: totales.total
          }
        },
        Detalle: this.buildDetalle(productos)
      };

      console.log('📤 Enviando boleta a LibreDTE:', JSON.stringify(dte, null, 2));

      // Endpoint de LibreDTE para emitir DTE
      const response = await this.request('/dte/documentos/emitir', {
        method: 'POST',
        body: JSON.stringify({
          dte,
          ambiente: this.ambiente,
          ...(opciones?.comment && { glosa: opciones.comment })
        })
      });

      console.log(`✅ BOLETA EMITIDA via LibreDTE: Folio ${response.folio}`);

      return {
        success: true,
        modo_prueba: false,
        data: response,
        folio: response.folio,
        pdf_url: response.pdf_url,
        xml_url: response.xml_url,
        track_id: response.track_id,
        ted: response.ted
      };

    } catch (error: any) {
      console.error('Error creando boleta en LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear Factura Electrónica (tipo 33)
   * Requiere datos del receptor (cliente)
   */
  async crearFactura(
    productos: ProductoDTE[],
    cliente: ClienteDTE,
    opciones?: EmisionDTEOptions
  ): Promise<LibreDTEResponse> {
    // Si está en modo prueba, simular respuesta
    if (this.modoPrueba) {
      return this.simularFactura(productos, cliente);
    }

    try {
      // Validar que el cliente tenga RUT
      if (!cliente.rut) {
        throw new Error('Se requiere RUT del cliente para emitir factura');
      }

      const fecha = opciones?.fecha_emision || this.getTodayDate();
      const totales = this.calcularTotales(productos);

      // Estructura del DTE para LibreDTE
      const dte: DTEData = {
        Encabezado: {
          IdDoc: {
            TipoDTE: TipoDocumento.FACTURA_ELECTRONICA,
            FchEmis: fecha,
            ...(opciones?.fecha_vencimiento && { FchVenc: opciones.fecha_vencimiento }),
            FmaPago: opciones?.forma_pago || 1,
            ...(opciones?.medio_pago && { MedioPago: opciones.medio_pago })
          },
          Emisor: {
            RUTEmisor: this.emisor.rut,
            RznSoc: this.emisor.razon_social,
            GiroEmis: this.emisor.giro,
            Acteco: this.emisor.acteco,
            DirOrigen: this.emisor.direccion,
            CmnaOrigen: this.emisor.comuna
          },
          Receptor: {
            RUTRecep: cliente.rut,
            RznSocRecep: cliente.name,
            ...(cliente.giro && { GiroRecep: cliente.giro }),
            ...(cliente.address && { DirRecep: cliente.address }),
            ...(cliente.comuna && { CmnaRecep: cliente.comuna }),
            ...(cliente.city && { CiudadRecep: cliente.city }),
            ...(cliente.email && { CorreoRecep: cliente.email })
          },
          Totales: {
            MntNeto: totales.neto,
            ...(totales.exento > 0 && { MntExe: totales.exento }),
            IVA: totales.iva,
            MntTotal: totales.total
          }
        },
        Detalle: this.buildDetalle(productos),
        // Referencia para notas de crédito/débito
        ...(opciones?.referencia && {
          Referencia: [{
            NroLinRef: 1,
            TpoDocRef: opciones.referencia.tipo_doc,
            FolioRef: opciones.referencia.folio,
            FchRef: opciones.referencia.fecha,
            RazonRef: opciones.referencia.razon
          }]
        })
      };

      console.log('📤 Enviando factura a LibreDTE');

      const response = await this.request('/dte/documentos/emitir', {
        method: 'POST',
        body: JSON.stringify({
          dte,
          ambiente: this.ambiente,
          ...(opciones?.comment && { glosa: opciones.comment }),
          ...(cliente.email && { enviar_email: true })
        })
      });

      console.log(`✅ FACTURA EMITIDA via LibreDTE: Folio ${response.folio}`);

      return {
        success: true,
        modo_prueba: false,
        data: response,
        folio: response.folio,
        pdf_url: response.pdf_url,
        xml_url: response.xml_url,
        track_id: response.track_id,
        ted: response.ted
      };

    } catch (error: any) {
      console.error('Error creando factura en LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear Nota de Crédito (tipo 61)
   */
  async crearNotaCredito(
    productos: ProductoDTE[],
    cliente: ClienteDTE,
    referencia: { tipo_doc: number; folio: number; fecha: string; razon: string },
    opciones?: EmisionDTEOptions
  ): Promise<LibreDTEResponse> {
    return this.crearFactura(productos, cliente, {
      ...opciones,
      referencia
    });
  }

  /**
   * Obtener DTEs emitidos
   */
  async obtenerDTEs(tipo: TipoDocumento, pagina: number = 1): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: true,
        modo_prueba: true,
        data: { items: [], total: 0, pagina: 1 }
      };
    }

    try {
      const response = await this.request(
        `/dte/dte_emitidos?tipo=${tipo}&page=${pagina}&rut_emisor=${this.emisor.rut}`
      );

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      console.error('Error obteniendo DTEs de LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener detalle de un DTE específico
   */
  async obtenerDTE(folio: number, tipo: TipoDocumento): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: false,
        error: 'No hay DTEs en modo prueba'
      };
    }

    try {
      const response = await this.request(
        `/dte/dte_emitidos/${this.emisor.rut}/${tipo}/${folio}`
      );

      return {
        success: true,
        data: response,
        folio: response.folio,
        pdf_url: response.pdf_url,
        xml_url: response.xml_url
      };

    } catch (error: any) {
      console.error('Error obteniendo DTE de LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener PDF de un DTE
   */
  async obtenerPDF(folio: number, tipo: TipoDocumento): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: false,
        error: 'No hay PDFs en modo prueba'
      };
    }

    try {
      const response = await this.request(
        `/dte/dte_emitidos/${this.emisor.rut}/${tipo}/${folio}/pdf`
      );

      return {
        success: true,
        pdf_url: response.url || response.pdf_url,
        data: response
      };

    } catch (error: any) {
      console.error('Error obteniendo PDF de LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener XML de un DTE
   */
  async obtenerXML(folio: number, tipo: TipoDocumento): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: false,
        error: 'No hay XMLs en modo prueba'
      };
    }

    try {
      const response = await this.request(
        `/dte/dte_emitidos/${this.emisor.rut}/${tipo}/${folio}/xml`
      );

      return {
        success: true,
        xml_url: response.url || response.xml_url,
        data: response
      };

    } catch (error: any) {
      console.error('Error obteniendo XML de LibreDTE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Consultar estado en el SII
   */
  async consultarEstadoSII(folio: number, tipo: TipoDocumento): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: true,
        modo_prueba: true,
        data: { estado: 'simulado', mensaje: 'Modo prueba activo' }
      };
    }

    try {
      const response = await this.request(
        `/dte/dte_emitidos/${this.emisor.rut}/${tipo}/${folio}/estado_sii`
      );

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      console.error('Error consultando estado SII:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verificar conexión con LibreDTE
   */
  async verificarConexion(): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: true,
        modo_prueba: true,
        data: {
          connected: true,
          message: 'Modo prueba activo - No se conecta a LibreDTE',
          ambiente: this.ambiente
        }
      };
    }

    try {
      // Intentar endpoint de health o info
      const response = await this.request('/health');

      return {
        success: true,
        data: {
          connected: true,
          message: 'Conexión exitosa con LibreDTE',
          ambiente: this.ambiente,
          version: response.version || 'unknown'
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Error de conexión: ${error.message}`,
        data: {
          connected: false,
          url: this.baseURL
        }
      };
    }
  }

  /**
   * Buscar cliente por RUT (en la BD local de LibreDTE)
   * Nota: LibreDTE no requiere clientes pre-registrados como Relbase
   */
  async buscarClientePorRut(rut: string): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: true,
        modo_prueba: true,
        data: null
      };
    }

    try {
      const response = await this.request(`/contribuyentes/${rut}`);

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      // Si no encuentra el cliente, no es un error crítico
      if (error.message.includes('404')) {
        return {
          success: true,
          data: null
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener productos (LibreDTE no maneja productos, retorna vacío)
   * Este método existe por compatibilidad con RelbaseService
   */
  async obtenerProductos(pagina: number = 1): Promise<LibreDTEResponse> {
    // LibreDTE no tiene catálogo de productos, los productos se envían en cada DTE
    return {
      success: true,
      data: {
        message: 'LibreDTE no maneja catálogo de productos. Los productos se envían directamente en cada DTE.',
        items: []
      }
    };
  }

  /**
   * Buscar producto por código (LibreDTE no maneja productos)
   * Este método existe por compatibilidad con RelbaseService
   */
  async buscarProductoPorCodigo(codigo: string): Promise<LibreDTEResponse> {
    return {
      success: true,
      data: null
    };
  }

  /**
   * Obtener clientes (lista de contribuyentes en LibreDTE)
   */
  async obtenerClientes(pagina: number = 1): Promise<LibreDTEResponse> {
    if (this.modoPrueba) {
      return {
        success: true,
        modo_prueba: true,
        data: { items: [] }
      };
    }

    try {
      const response = await this.request(`/contribuyentes?page=${pagina}`);

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exportar instancia singleton
export const libreDTEService = new LibreDTEService();
export default libreDTEService;
