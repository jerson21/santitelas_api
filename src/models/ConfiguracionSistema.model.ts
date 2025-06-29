// src/models/ConfiguracionSistema.model.ts - NUEVO MODELO
import { 
    Table, 
    Column, 
    Model, 
    DataType, 
    PrimaryKey, 
    AutoIncrement
  } from 'sequelize-typescript';
  
  @Table({
    tableName: 'configuracion_sistema',
    timestamps: true
  })
  export class ConfiguracionSistema extends Model {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    id_configuracion!: number;
  
    @Column({
      type: DataType.STRING(100),
      unique: true,
      allowNull: false
    })
    clave!: string;
  
    @Column({
      type: DataType.TEXT,
      allowNull: false
    })
    valor!: string;
  
    @Column({
      type: DataType.ENUM('string', 'number', 'boolean', 'json'),
      defaultValue: 'string'
    })
    tipo!: string;
  
    @Column({
      type: DataType.STRING(200)
    })
    descripcion?: string;
  
    @Column({
      type: DataType.STRING(50),
      defaultValue: 'general'
    })
    categoria!: string;
  
    @Column({
      type: DataType.BOOLEAN,
      defaultValue: true
    })
    activa!: boolean;
  
    // Métodos helpers
    getValorTipado(): any {
      switch (this.tipo) {
        case 'boolean':
          return this.valor === 'true';
        case 'number':
          return parseFloat(this.valor);
        case 'json':
          try {
            return JSON.parse(this.valor);
          } catch {
            return {};
          }
        default:
          return this.valor;
      }
    }
  
    static async obtenerConfiguracion(clave: string, valorPorDefecto: any = null) {
      const config = await ConfiguracionSistema.findOne({
        where: { clave, activa: true }
      });
      
      return config ? config.getValorTipado() : valorPorDefecto;
    }
  
    static async actualizarConfiguracion(clave: string, valor: any, descripcion?: string) {
      const valorString = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
      const tipo = typeof valor === 'object' ? 'json' : typeof valor;
  
      const [config] = await ConfiguracionSistema.upsert({
        clave,
        valor: valorString,
        tipo,
        descripcion,
        activa: true
      });
  
      return config;
    }
  }
  
  // =====================================================================
  // CONFIGURACIONES POR DEFECTO DEL SISTEMA
  // =====================================================================
  
  export const CONFIGURACIONES_DEFAULT = {
    // Stock y Ventas
    'stock.permite_venta_sin_stock': {
      valor: false,
      tipo: 'boolean',
      descripcion: 'Permitir ventas cuando no hay stock disponible',
      categoria: 'stock'
    },
    'stock.auto_asignar_bodega': {
      valor: true,
      tipo: 'boolean',
      descripcion: 'Asignar automáticamente la bodega para ventas',
      categoria: 'stock'
    },
    'stock.prioridad_bodega': {
      valor: 'mayor_stock',
      tipo: 'string',
      descripcion: 'Criterio para asignar bodega: mayor_stock, mas_cercana, fifo',
      categoria: 'stock'
    },
    'stock.reserva_temporal_minutos': {
      valor: 30,
      tipo: 'number',
      descripcion: 'Tiempo en minutos para reservas temporales en vales',
      categoria: 'stock'
    },
    'stock.mostrar_stock_por_bodega': {
      valor: true,
      tipo: 'boolean',
      descripcion: 'Mostrar detalles de stock por bodega en el admin',
      categoria: 'stock'
    },
  
    // Proceso de Venta
    'venta.validar_stock_en_vale': {
      valor: true,
      tipo: 'boolean',
      descripcion: 'Validar disponibilidad de stock al crear vales',
      categoria: 'venta'
    },
    'venta.crear_reserva_temporal': {
      valor: true,
      tipo: 'boolean',
      descripcion: 'Crear reserva temporal al generar vale',
      categoria: 'venta'
    },
    'venta.timeout_vale_minutos': {
      valor: 60,
      tipo: 'number',
      descripcion: 'Tiempo máximo para procesar un vale antes de liberar reserva',
      categoria: 'venta'
    },
  
    // UI/UX
    'ui.modo_stock_default': {
      valor: 'unificado',
      tipo: 'string',
      descripcion: 'Vista por defecto: unificado, por_bodega, ambos',
      categoria: 'ui'
    },
    'ui.alertas_stock_activas': {
      valor: true,
      tipo: 'boolean',
      descripcion: 'Mostrar alertas de stock bajo en el dashboard',
      categoria: 'ui'
    }
  };
  
  // =====================================================================
  // SERVICIO DE CONFIGURACIÓN
  // =====================================================================
  
  export class ConfiguracionService {
    private static cache = new Map<string, { valor: any; timestamp: number }>();
    private static CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  
    static async obtener<T = any>(clave: string, valorPorDefecto: T = null as T): Promise<T> {
      // Verificar cache
      const cached = this.cache.get(clave);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        return cached.valor;
      }
  
      // Obtener de BD
      const valor = await ConfiguracionSistema.obtenerConfiguracion(clave, valorPorDefecto);
      
      // Actualizar cache
      this.cache.set(clave, { valor, timestamp: Date.now() });
      
      return valor;
    }
  
    static async actualizar(clave: string, valor: any, descripcion?: string) {
      await ConfiguracionSistema.actualizarConfiguracion(clave, valor, descripcion);
      
      // Limpiar cache
      this.cache.delete(clave);
      
      return true;
    }
  
    static async obtenerPorCategoria(categoria: string) {
      const configuraciones = await ConfiguracionSistema.findAll({
        where: { categoria, activa: true },
        order: [['clave', 'ASC']]
      });
  
      return configuraciones.reduce((acc, config) => {
        acc[config.clave] = config.getValorTipado();
        return acc;
      }, {} as Record<string, any>);
    }
  
    static limpiarCache() {
      this.cache.clear();
    }
  
    // Configuraciones específicas más usadas
    static async getConfigStock() {
      return {
        permite_venta_sin_stock: await this.obtener('stock.permite_venta_sin_stock', false),
        auto_asignar_bodega: await this.obtener('stock.auto_asignar_bodega', true),
        prioridad_bodega: await this.obtener('stock.prioridad_bodega', 'mayor_stock'),
        reserva_temporal_minutos: await this.obtener('stock.reserva_temporal_minutos', 30),
        mostrar_stock_por_bodega: await this.obtener('stock.mostrar_stock_por_bodega', true)
      };
    }
  
    static async getConfigVenta() {
      return {
        validar_stock_en_vale: await this.obtener('venta.validar_stock_en_vale', true),
        crear_reserva_temporal: await this.obtener('venta.crear_reserva_temporal', true),
        timeout_vale_minutos: await this.obtener('venta.timeout_vale_minutos', 60)
      };
    }
  }
  