// src/models/Pedido.model.ts - VERSIÓN FINAL CON NUMERACIÓN DIARIA
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey
} from 'sequelize-typescript';
import { Op } from 'sequelize'; // ✅ IMPORTACIÓN AGREGADA
import { Usuario } from './Usuario.model';
import { Cliente } from './Cliente.model';
import { DetallePedido } from './DetallePedido.model';
import { Venta } from './Venta.model';

// Define un tipo para el estado de pedido
export type EstadoPedido =
  | 'borrador'
  | 'pendiente'
  | 'vale_pendiente'
  | 'procesando_caja'
  | 'pagado_datos_pendientes'
  | 'completado'
  | 'cancelado';

@Table({
  tableName: 'pedidos',
  timestamps: false
})
export class Pedido extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id_pedido!: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'Número único generado por procedimiento: VP20250602-0001'
  })
  numero_pedido!: string;

  // ✅ CAMPO CLAVE: Número secuencial diario generado por procedimiento
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    comment: 'Número secuencial del día (1, 2, 3...) generado por procedimiento almacenado'
  })
  numero_diario!: number;

  @ForeignKey(() => Usuario)
  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  id_vendedor!: number;

  @ForeignKey(() => Cliente)
  @Column({
    type: DataType.INTEGER
  })
  id_cliente?: number;

  // TOTALES (corregido para usar DECIMAL como en la BD)
  @Column({
    type: DataType.DECIMAL(10, 0),
    defaultValue: 0
  })
  subtotal!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    defaultValue: 0
  })
  descuento!: number;

  @Column({
    type: DataType.DECIMAL(10, 0),
    defaultValue: 0
  })
  total!: number;

  // TIPO DE DOCUMENTO
  @Column({
    type: DataType.ENUM('ticket', 'boleta', 'factura'),
    defaultValue: 'ticket'
  })
  tipo_documento!: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true
  })
  datos_completos!: boolean;

  // Estado pedido
  @Column({
    type: DataType.ENUM(
      'borrador',
      'pendiente',
      'vale_pendiente',
      'procesando_caja',
      'pagado_datos_pendientes',
      'completado',
      'cancelado'
    ),
    defaultValue: 'borrador'
  })
  estado!: EstadoPedido;

  @Column(DataType.TEXT)
  observaciones?: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_creacion!: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW
  })
  fecha_actualizacion!: Date;

  // ===== RELACIONES (definidas en associations.ts) =====
  vendedor!: Usuario;
  cliente?: Cliente;
  detalles!: DetallePedido[];
  venta?: Venta;

  // ===== MÉTODOS DE NUMERACIÓN DIARIA =====

  /**
   * Obtiene el número que se muestra al cliente (solo número del día)
   * @returns Número formateado con ceros a la izquierda (001, 002, etc.)
   */
  getNumeroCliente(): string {
    return String(this.numero_diario).padStart(3, '0');
  }

  /**
   * Obtiene el número completo para referencia interna y búsquedas
   * @returns Número completo formato VP20250602-0001
   */
  getNumeroCompleto(): string {
    return this.numero_pedido;
  }

  /**
   * Extrae la fecha del número de pedido (formato VP20250602-0001)
   * @returns Fecha formateada DD/MM/YYYY
   */
  getFechaDesdeNumero(): string {
    const match = this.numero_pedido.match(/VP(\d{8})-/);
    if (match) {
      const fechaStr = match[1]; // 20250602
      const año = fechaStr.substring(0, 4);
      const mes = fechaStr.substring(4, 6);
      const dia = fechaStr.substring(6, 8);
      return `${dia}/${mes}/${año}`;
    }
    return this.fecha_creacion?.toLocaleDateString('es-CL') || 'Fecha no disponible';
  }

  /**
   * Obtiene la fecha formateada desde fecha_creacion
   * @returns Fecha formateada DD/MM/YYYY
   */
  getFechaFormateada(): string {
    return this.fecha_creacion?.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) || 'Fecha no disponible';
  }

  /**
   * Obtiene la hora formateada desde fecha_creacion
   * @returns Hora formateada HH:MM
   */
  getHoraFormateada(): string {
    return this.fecha_creacion?.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    }) || 'Hora no disponible';
  }

  /**
   * Verifica si es un vale del día actual
   * @returns true si el vale fue creado hoy
   */
  esValeDelDia(): boolean {
    if (!this.fecha_creacion) return false;
    const hoy = new Date().toISOString().split('T')[0];
    const fechaCreacion = this.fecha_creacion.toISOString().split('T')[0];
    return hoy === fechaCreacion;
  }

  /**
   * Calcula los días transcurridos desde la creación
   * @returns Número de días transcurridos
   */
  getDiasTranscurridos(): number {
    if (!this.fecha_creacion) return 0;
    const ahora = new Date();
    const fechaCreacion = new Date(this.fecha_creacion);
    const diferencia = ahora.getTime() - fechaCreacion.getTime();
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si el vale está vencido (más de 7 días)
   * @returns true si han pasado más de 7 días
   */
  estaVencido(): boolean {
    return this.getDiasTranscurridos() > 7;
  }

  // ===== MÉTODOS DE ESTADO Y DESCRIPCIÓN =====

  /**
   * Descripción del estado con número de cliente incluido
   * @returns Descripción del estado con número de vale
   */
  getEstadoConNumero(): string {
    const numeroCliente = this.getNumeroCliente();
    const descripciones: Record<EstadoPedido, string> = {
      borrador: 'En proceso',
      pendiente: 'Listo para procesar',
      vale_pendiente: `📋 Vale #${numeroCliente} - Esperando en caja`,
      procesando_caja: `⏳ Vale #${numeroCliente} - Procesando pago`,
      pagado_datos_pendientes: `💰 Vale #${numeroCliente} - Pagado`,
      completado: `✅ Vale #${numeroCliente} - Completado`,
      cancelado: `❌ Vale #${numeroCliente} - Cancelado`
    };
    return descripciones[this.estado] || this.estado;
  }

  /**
   * Descripción del estado sin número de vale
   * @returns Descripción simple del estado
   */
  getEstadoDescripcion(): string {
    const descripciones: Record<EstadoPedido, string> = {
      borrador: 'En proceso',
      pendiente: 'Listo para procesar',
      vale_pendiente: '📋 Esperando en caja',
      procesando_caja: '⏳ Procesando pago',
      pagado_datos_pendientes: '💰 Pagado - Faltan datos',
      completado: '✅ Completado',
      cancelado: '❌ Cancelado'
    };
    return descripciones[this.estado] || this.estado;
  }

  /**
   * Obtiene el color CSS para el estado
   * @returns Clases CSS para mostrar el estado
   */
  getEstadoColor(): string {
    const colores: Record<EstadoPedido, string> = {
      borrador: 'bg-gray-100 text-gray-800 border-gray-300',
      pendiente: 'bg-blue-100 text-blue-800 border-blue-300',
      vale_pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      procesando_caja: 'bg-blue-100 text-blue-800 border-blue-300',
      pagado_datos_pendientes: 'bg-purple-100 text-purple-800 border-purple-300',
      completado: 'bg-green-100 text-green-800 border-green-300',
      cancelado: 'bg-red-100 text-red-800 border-red-300'
    };
    return colores[this.estado] || 'bg-gray-100 text-gray-800 border-gray-300';
  }

  /**
   * Obtiene información completa para mostrar en caja
   * @returns Objeto con toda la información necesaria para el cajero
   */
  getInfoParaCaja() {
    const diasTranscurridos = this.getDiasTranscurridos();
    
    return {
      // Números de identificación
      numero_cliente: this.getNumeroCliente(),
      numero_completo: this.getNumeroCompleto(),
      numero_diario: this.numero_diario,
      
      // Información temporal
      fecha: this.getFechaFormateada(),
      hora: this.getHoraFormateada(),
      fecha_desde_numero: this.getFechaDesdeNumero(),
      dias_transcurridos: diasTranscurridos,
      es_del_dia: this.esValeDelDia(),
      esta_vencido: this.estaVencido(),
      
      // Estado y procesamiento
      estado: this.estado,
      estado_descripcion: this.getEstadoConNumero(),
      estado_color: this.getEstadoColor(),
      puede_procesar: this.puedeProcesamientoPago(),
      puede_cancelar: this.puedeCancelar(),
      
      // Información financiera
      total: this.total,
      subtotal: this.subtotal,
      descuento: this.descuento,
      total_formateado: this.formatearMonto(this.total),
      
      // Información del documento
      tipo_documento: this.tipo_documento,
      datos_completos: this.datos_completos,
      necesita_datos: this.necesitaCompletarDatos(),
      
      // Advertencias
      advertencia: diasTranscurridos > 0 ? `Este vale tiene ${diasTranscurridos} día(s) de antigüedad` : null,
      urgente: diasTranscurridos >= 6 ? 'Vale próximo a vencer' : null
    };
  }

  // ===== MÉTODOS DE NEGOCIO =====

  /**
   * Calcula los totales del pedido
   */
  calcularTotales(): void {
    this.total = Number(this.subtotal) - Number(this.descuento);
  }

  /**
   * Verifica si el pedido es un vale
   * @returns true si está en estado de vale
   */
  esVale(): boolean {
    return ['vale_pendiente', 'procesando_caja'].includes(this.estado);
  }

  /**
   * Verifica si el pedido puede ser modificado
   * @returns true si puede ser modificado
   */
  puedeModificar(): boolean {
    return ['borrador', 'vale_pendiente'].includes(this.estado);
  }

  /**
   * Verifica si el pedido puede ser cancelado
   * @returns true si puede ser cancelado
   */
  puedeCancelar(): boolean {
    return ['borrador', 'pendiente', 'vale_pendiente', 'procesando_caja'].includes(this.estado);
  }

  /**
   * Verifica si necesita completar datos del cliente
   * @returns true si necesita completar datos
   */
  necesitaCompletarDatos(): boolean {
    return this.estado === 'pagado_datos_pendientes' ||
      (this.tipo_documento === 'factura' && !this.datos_completos);
  }

  /**
   * Verifica si puede ser procesado para pago
   * @returns true si puede ser procesado
   */
  puedeProcesamientoPago(): boolean {
    return ['vale_pendiente', 'procesando_caja'].includes(this.estado);
  }

  /**
   * Obtiene el nombre del cliente para mostrar
   * @returns Nombre del cliente o descripción por defecto
   */
  getNombreCliente(): string {
    if (this.cliente && (this.cliente as any).getNombreCompleto) {
      return (this.cliente as any).getNombreCompleto();
    }
    if (this.cliente && (this.cliente as any).nombre) {
      return (this.cliente as any).nombre;
    }
    switch (this.tipo_documento) {
      case 'ticket':
        return 'Cliente anónimo';
      case 'factura':
        return 'Empresa (datos pendientes)';
      default:
        return 'Cliente express';
    }
  }

  // ===== MÉTODOS HELPER ADICIONALES =====

  /**
   * Formatea un monto en pesos chilenos
   * @param monto Monto a formatear
   * @returns Monto formateado ($123.456)
   */
  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(monto || 0);
  }

  /**
   * Obtiene un resumen del vale para notificaciones
   * @returns Texto resumen para mostrar en alertas o notificaciones
   */
  getResumenVale(): string {
    const numero = this.getNumeroCliente();
    const total = this.formatearMonto(this.total);
    const estado = this.getEstadoDescripcion();
    
    return `Vale #${numero} - ${total} - ${estado}`;
  }

  /**
   * Verifica si el vale puede ser editado por el vendedor
   * @returns true si el vendedor puede hacer cambios
   */
  puedeEditarVendedor(): boolean {
    return ['borrador', 'vale_pendiente'].includes(this.estado) && !this.estaVencido();
  }

  /**
   * Obtiene el tiempo de espera en formato legible
   * @returns Texto describiendo el tiempo transcurrido
   */
  getTiempoEspera(): string {
    const ahora = new Date();
    const fechaCreacion = new Date(this.fecha_creacion);
    const diferencia = ahora.getTime() - fechaCreacion.getTime();
    
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (dias > 0) {
      return `${dias} día${dias > 1 ? 's' : ''}`;
    } else if (horas > 0) {
      return `${horas} hora${horas > 1 ? 's' : ''}`;
    } else {
      return `${minutos} minuto${minutos > 1 ? 's' : ''}`;
    }
  }

  /**
   * Valida si el vale está en un estado válido para procesar
   * @returns Objeto con resultado de validación
   */
  validarParaProcesamiento(): { valido: boolean; mensaje: string } {
    if (this.estaVencido()) {
      return {
        valido: false,
        mensaje: `Vale #${this.getNumeroCliente()} está vencido (${this.getDiasTranscurridos()} días)`
      };
    }

    if (!this.puedeProcesamientoPago()) {
      return {
        valido: false,
        mensaje: `Vale #${this.getNumeroCliente()} no puede ser procesado (estado: ${this.estado})`
      };
    }

    if (this.total <= 0) {
      return {
        valido: false,
        mensaje: `Vale #${this.getNumeroCliente()} tiene total inválido`
      };
    }

    return {
      valido: true,
      mensaje: `Vale #${this.getNumeroCliente()} listo para procesar`
    };
  }

  // ===== MÉTODOS ESTÁTICOS PARA CONSULTAS =====

  /**
   * Genera un filtro para buscar vales del día actual
   * @returns Condición WHERE para Sequelize
   */
  static getFiltroDelDia() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finHoy = new Date();
    finHoy.setHours(23, 59, 59, 999);

    return {
      fecha_creacion: {
        [Op.between]: [hoy, finHoy]
      }
    };
  }

  /**
   * Genera un filtro para buscar vales pendientes
   * @returns Condición WHERE para Sequelize
   */
  static getFiltroPendientes() {
    return {
      estado: {
        [Op.in]: ['vale_pendiente', 'procesando_caja']
      }
    };
  }

  /**
   * Valida formato de número de pedido
   * @param numeroPedido Número a validar
   * @returns true si es válido
   */
  static validarFormatoNumero(numeroPedido: string): boolean {
    return /^VP\d{8}-\d{4}$/.test(numeroPedido);
  }

  /**
   * Extrae el número diario de un número completo
   * @param numeroCompleto Número completo formato VP20250602-0001
   * @returns Número diario (1, 2, 3, etc.)
   */
  static extraerNumeroDiario(numeroCompleto: string): number | null {
    const match = numeroCompleto.match(/VP\d{8}-(\d{4})$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extrae la fecha de un número completo
   * @param numeroCompleto Número completo formato VP20250602-0001
   * @returns Fecha como string YYYY-MM-DD o null
   */
  static extraerFechaDeNumero(numeroCompleto: string): string | null {
    const match = numeroCompleto.match(/VP(\d{8})-\d{4}$/);
    if (match) {
      const fechaStr = match[1]; // 20250602
      const año = fechaStr.substring(0, 4);
      const mes = fechaStr.substring(4, 6);
      const dia = fechaStr.substring(6, 8);
      return `${año}-${mes}-${dia}`;
    }
    return null;
  }
}