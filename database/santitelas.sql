-- ==========================================================
-- SANTITELAS - SISTEMA DE PUNTO DE VENTA
-- Base de datos completa organizada y optimizada
-- VERSIÓN CORREGIDA PARA MySQL 8.0 - SIN ERRORES DE SINTAXIS
-- NOTA: LOS PROCEDURES ESTÁN EN ARCHIVO SEPARADO
-- ==========================================================

CREATE DATABASE IF NOT EXISTS santitelas;
USE santitelas;

-- ==========================================================
-- LIMPIEZA INICIAL (para evitar conflictos en recompilaciones)
-- ==========================================================

-- Deshabilitar foreign key checks temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar datos existentes (solo si existen las tablas)
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS arqueos_caja;
DROP TABLE IF EXISTS turnos_caja;
DROP TABLE IF EXISTS detalle_pedidos;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS movimientos_stock;
DROP TABLE IF EXISTS stock_por_bodega;
DROP TABLE IF EXISTS modalidades_producto;
DROP TABLE IF EXISTS variantes_producto;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS cajas;
DROP TABLE IF EXISTS metodos_pago;
DROP TABLE IF EXISTS bodegas;
DROP TABLE IF EXISTS tipos_documento;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;

/* -- Limpiar funciones y procedures existentes
DROP PROCEDURE IF EXISTS crear_modalidades_para_variante;
DROP FUNCTION IF EXISTS obtener_precio_modalidad;
DROP FUNCTION IF EXISTS calcular_stock_total_variante;
DROP FUNCTION IF EXISTS obtener_stock_en_bodega;
DROP FUNCTION IF EXISTS generar_numero_pedido;
DROP FUNCTION IF EXISTS generar_numero_pedido_simple;
DROP FUNCTION IF EXISTS obtener_proximo_numero_diario;
DROP FUNCTION IF EXISTS generar_numero_venta;

-- Limpiar vistas existentes
DROP VIEW IF EXISTS vista_productos_completa;
DROP VIEW IF EXISTS vista_detalle_pedidos_completa;
DROP VIEW IF EXISTS vista_clientes_datos_pendientes;
DROP VIEW IF EXISTS vista_stock_productos;
DROP VIEW IF EXISTS vista_productos_por_tipo; */

-- Rehabilitar foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- 1. TABLAS DE CONFIGURACIÓN Y MAESTROS
-- ==========================================================

-- Roles del sistema
CREATE TABLE roles (
    id_rol INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSON,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios del sistema
CREATE TABLE usuarios (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefono VARCHAR(20),
    id_rol INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
    INDEX idx_usuario (usuario),
    INDEX idx_activo (activo)
);

-- Categorías de productos
CREATE TABLE categorias (
    id_categoria INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_activa (activa)
);

-- Tipos de documento fiscal
CREATE TABLE tipos_documento (
    id_tipo_documento INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descripcion TEXT,
    requiere_rut_cliente BOOLEAN DEFAULT FALSE,
    es_fiscal BOOLEAN DEFAULT FALSE,
    aplica_iva BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_codigo (codigo),
    INDEX idx_activo (activo)
);

-- Bodegas y puntos de venta
CREATE TABLE bodegas (
    id_bodega INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(200),
    es_punto_venta BOOLEAN DEFAULT FALSE,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_codigo (codigo),
    INDEX idx_punto_venta (es_punto_venta),
    INDEX idx_activa (activa)
);

-- Métodos de pago
CREATE TABLE metodos_pago (
    id_metodo INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    tipo ENUM('efectivo', 'tarjeta', 'transferencia', 'otro') NOT NULL,
    requiere_referencia BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_codigo (codigo),
    INDEX idx_tipo (tipo),
    INDEX idx_activo (activo)
);

-- Cajas registradoras
CREATE TABLE cajas (
    id_caja INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    ubicacion VARCHAR(100),
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_activa (activa)
);

-- ==========================================================
-- 2. GESTIÓN DE PRODUCTOS - NUEVA ESTRUCTURA
-- ==========================================================

-- Productos base (PLANTILLAS DE PRECIOS)
CREATE TABLE productos (
    id_producto INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    id_categoria INT NOT NULL,
    tipo VARCHAR(50) NULL,                      -- LINO, FELPA, ECO CUERO, etc.
    stock_minimo_total DECIMAL(10,2) DEFAULT 0,
    unidad_medida ENUM('metro', 'unidad', 'kilogramo', 'litros') DEFAULT 'unidad',
    
    -- PLANTILLA DE PRECIOS (para heredar a variantes)
    precio_costo_base DECIMAL(10,0) DEFAULT 0,
    precio_neto_base DECIMAL(10,0) DEFAULT 0,
    precio_neto_factura_base DECIMAL(10,0) DEFAULT 0,
    
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
    INDEX idx_categoria (id_categoria),
    INDEX idx_tipo (tipo),
    INDEX idx_codigo (codigo),
    INDEX idx_activo (activo),
    INDEX idx_nombre (nombre)
);

-- Variantes de productos (colores, medidas, materiales)
CREATE TABLE variantes_producto (
    id_variante_producto INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(30),
    medida VARCHAR(20),
    material VARCHAR(50),
    descripcion TEXT,
    stock_minimo DECIMAL(10,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    INDEX idx_producto (id_producto),
    INDEX idx_sku (sku),
    INDEX idx_color (color),
    INDEX idx_medida (medida),
    INDEX idx_activo (activo)
);

-- NUEVA ESTRUCTURA: Modalidades por VARIANTE específica
CREATE TABLE modalidades_producto (
    id_modalidad INT PRIMARY KEY AUTO_INCREMENT,
    id_variante_producto INT NOT NULL,          -- CAMBIO: Ahora apunta a variante específica
    nombre VARCHAR(50) NOT NULL,                -- "METRO", "ROLLO", "UNIDAD", "EMBALAJE"
    descripcion VARCHAR(100),                   -- "Venta al corte por metro"
    cantidad_base DECIMAL(10,2) NOT NULL,       -- 1, 4, 30
    es_cantidad_variable BOOLEAN DEFAULT FALSE, -- TRUE para metros/rollos variables
    minimo_cantidad DECIMAL(10,2) DEFAULT 0,    -- Para rollos mínimo 30m
    
    -- Precios específicos por variante (en pesos chilenos CLP)
    precio_costo DECIMAL(10,0) DEFAULT 0,
    precio_neto DECIMAL(10,0) NOT NULL,
    precio_neto_factura DECIMAL(10,0) NOT NULL,
    
    -- Precio final calculado (con IVA sobre precio_neto_factura)
    precio_con_iva DECIMAL(10,0) GENERATED ALWAYS AS (ROUND(precio_neto_factura * 1.19, 0)) STORED,
    
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- CAMBIO: Foreign key a variante específica
    FOREIGN KEY (id_variante_producto) REFERENCES variantes_producto(id_variante_producto) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_variante_producto (id_variante_producto),
    INDEX idx_activa (activa),
    INDEX idx_precio_neto (precio_neto),
    UNIQUE KEY unique_variante_modalidad(id_variante_producto, nombre)
);

-- Control de stock por bodega
CREATE TABLE stock_por_bodega (
    id_stock INT PRIMARY KEY AUTO_INCREMENT,
    id_variante_producto INT NOT NULL,
    id_bodega INT NOT NULL,
    cantidad_disponible DECIMAL(10,2) DEFAULT 0,
    cantidad_reservada DECIMAL(10,2) DEFAULT 0,
    stock_minimo DECIMAL(10,2) DEFAULT 0,
    stock_maximo DECIMAL(10,2) DEFAULT 0,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_variante_producto) REFERENCES variantes_producto(id_variante_producto),
    FOREIGN KEY (id_bodega) REFERENCES bodegas(id_bodega),
    UNIQUE KEY unique_variante_bodega(id_variante_producto, id_bodega),
    INDEX idx_variante (id_variante_producto),
    INDEX idx_bodega (id_bodega)
);

-- Historial de movimientos de stock
CREATE TABLE movimientos_stock (
    id_movimiento INT PRIMARY KEY AUTO_INCREMENT,
    id_variante_producto INT NOT NULL,
    id_bodega INT NOT NULL,
    tipo_movimiento ENUM('entrada', 'salida', 'ajuste', 'transferencia') NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    stock_anterior DECIMAL(10,2) NOT NULL,
    stock_nuevo DECIMAL(10,2) NOT NULL,
    id_bodega_destino INT NULL,
    motivo VARCHAR(100) NOT NULL,
    referencia VARCHAR(50),
    id_usuario INT NOT NULL,
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_variante_producto) REFERENCES variantes_producto(id_variante_producto),
    FOREIGN KEY (id_bodega) REFERENCES bodegas(id_bodega),
    FOREIGN KEY (id_bodega_destino) REFERENCES bodegas(id_bodega),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    INDEX idx_variante (id_variante_producto),
    INDEX idx_bodega (id_bodega),
    INDEX idx_fecha (fecha_movimiento),
    INDEX idx_tipo (tipo_movimiento)
);

-- ==========================================================
-- 3. GESTIÓN DE CLIENTES
-- ==========================================================

-- Clientes
CREATE TABLE clientes (
    id_cliente INT PRIMARY KEY AUTO_INCREMENT,
    rut VARCHAR(15) UNIQUE NOT NULL,
    tipo_cliente ENUM('persona', 'empresa') NOT NULL,
    
    -- Datos básicos
    nombre VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    
    -- Datos empresa (solo si tipo_cliente = 'empresa')
    razon_social VARCHAR(100),
    direccion TEXT,
    
    -- Control
    activo BOOLEAN DEFAULT TRUE,
    datos_completos BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_rut (rut),
    INDEX idx_tipo (tipo_cliente),
    INDEX idx_datos_completos (datos_completos),
    INDEX idx_activo (activo)
);

-- ==========================================================
-- 4. GESTIÓN DE PEDIDOS Y VENTAS CON NUMERACIÓN DIARIA
-- ==========================================================

-- Pedidos (preventa/cotización) - ✅ CON NUMERACIÓN DIARIA CORREGIDA
CREATE TABLE pedidos (
    id_pedido INT PRIMARY KEY AUTO_INCREMENT,
    numero_pedido VARCHAR(20) NOT NULL UNIQUE,
    
    -- ✅ CAMPO CLAVE: Número secuencial diario generado por procedimiento
    numero_diario INT NOT NULL DEFAULT 1 
    COMMENT 'Número secuencial del día (1, 2, 3...) generado por procedimiento almacenado',
    
    id_vendedor INT NOT NULL,
    id_cliente INT NULL,
    
    -- Totales (sin decimales para pesos chilenos)
    subtotal DECIMAL(10,0) DEFAULT 0,
    descuento DECIMAL(10,0) DEFAULT 0,
    total DECIMAL(10,0) DEFAULT 0,
    
    -- Documento y control
    tipo_documento ENUM('ticket', 'boleta', 'factura') DEFAULT 'ticket',
    datos_completos BOOLEAN DEFAULT TRUE,
    
    -- Estados para flujo de vales
    estado ENUM(
        'borrador',
        'pendiente',
        'vale_pendiente',
        'procesando_caja',
        'pagado_datos_pendientes',
        'completado',
        'cancelado'
    ) DEFAULT 'borrador',
    
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_vendedor) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    
    INDEX idx_numero_pedido (numero_pedido),
    INDEX idx_numero_diario (numero_diario),
    INDEX idx_vendedor (id_vendedor),
    INDEX idx_cliente (id_cliente),
    INDEX idx_estado (estado),
    INDEX idx_fecha_creacion (fecha_creacion),
    INDEX idx_tipo_documento (tipo_documento),
    -- ✅ ÍNDICE CORREGIDO PARA MySQL 8.0 - SIN FUNCIÓN DATE()
    INDEX idx_fecha_numero_diario (fecha_creacion, numero_diario)
);

-- Detalle de pedidos
CREATE TABLE detalle_pedidos (
    id_detalle INT PRIMARY KEY AUTO_INCREMENT,
    id_pedido INT NOT NULL,
    
    -- RELACIONES: Necesitamos AMBOS para saber qué se vende y cómo
    id_variante_producto INT NOT NULL,      -- QUÉ variante/color específica se lleva
    id_modalidad INT NOT NULL,              -- CÓMO se vende (metro/rollo/set) y precio
    
    -- CANTIDADES Y PRECIOS
    cantidad DECIMAL(10,2) NOT NULL,                -- Permite decimales para metros, kilos, etc.
    precio_unitario DECIMAL(10,0) NOT NULL,         -- Sin decimales para pesos chilenos
    
    -- CONTROL DE TIPO DE PRECIO APLICADO
    tipo_precio ENUM('neto', 'factura', 'personalizado') NOT NULL DEFAULT 'neto',
    -- 'neto' = precio_neto, 'factura' = precio_neto_factura, 'personalizado' = precio autorizado por dueño
    
    -- AUTORIZACIÓN PARA PRECIOS PERSONALIZADOS
    precio_autorizado_por INT NULL,  -- id del usuario que autorizó el precio personalizado
    motivo_precio_personalizado VARCHAR(200) NULL,  -- razón del precio especial
    
    -- SUBTOTAL CALCULADO
    subtotal DECIMAL(10,0) NOT NULL,                -- cantidad * precio_unitario
    
    -- INFORMACIÓN ADICIONAL
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- RELACIONES
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_variante_producto) REFERENCES variantes_producto(id_variante_producto),
    FOREIGN KEY (id_modalidad) REFERENCES modalidades_producto(id_modalidad),
    FOREIGN KEY (precio_autorizado_por) REFERENCES usuarios(id_usuario),
    
    -- ÍNDICES
    INDEX idx_pedido (id_pedido),
    INDEX idx_variante_producto (id_variante_producto),
    INDEX idx_modalidad (id_modalidad),
    INDEX idx_tipo_precio (tipo_precio),
    INDEX idx_precio_autorizado (precio_autorizado_por)
);

-- ==========================================================
-- 5. GESTIÓN DE CAJA Y TURNOS
-- ==========================================================

-- Turnos de caja
CREATE TABLE turnos_caja (
    id_turno INT PRIMARY KEY AUTO_INCREMENT,
    id_caja INT NOT NULL,
    id_cajero INT NOT NULL,
    
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    
    monto_inicial DECIMAL(10,2) NOT NULL,
    monto_teorico_cierre DECIMAL(10,2) DEFAULT 0,
    monto_real_cierre DECIMAL(10,2) NULL,
    diferencia DECIMAL(10,2) DEFAULT 0,
    
    total_ventas DECIMAL(10,2) DEFAULT 0,
    cantidad_ventas INT DEFAULT 0,
    
    estado ENUM('abierto', 'cerrado') DEFAULT 'abierto',
    observaciones_apertura TEXT,
    observaciones_cierre TEXT,
    
    FOREIGN KEY (id_caja) REFERENCES cajas(id_caja),
    FOREIGN KEY (id_cajero) REFERENCES usuarios(id_usuario),
    INDEX idx_estado (estado),
    INDEX idx_cajero (id_cajero),
    INDEX idx_fecha_apertura (fecha_apertura)
);

-- Arqueos de caja
CREATE TABLE arqueos_caja (
    id_arqueo INT PRIMARY KEY AUTO_INCREMENT,
    id_turno INT NOT NULL,
    
    -- Conteo de billetes
    billetes_20000 INT DEFAULT 0,
    billetes_10000 INT DEFAULT 0,
    billetes_5000 INT DEFAULT 0,
    billetes_2000 INT DEFAULT 0,
    billetes_1000 INT DEFAULT 0,
    
    -- Conteo de monedas
    monedas_500 INT DEFAULT 0,
    monedas_100 INT DEFAULT 0,
    monedas_50 INT DEFAULT 0,
    monedas_10 INT DEFAULT 0,
    
    -- Totales calculados
    total_contado DECIMAL(10,2) DEFAULT 0,
    total_teorico DECIMAL(10,2) DEFAULT 0,
    diferencia DECIMAL(10,2) DEFAULT 0,
    
    observaciones TEXT,
    fecha_arqueo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_turno) REFERENCES turnos_caja(id_turno),
    INDEX idx_turno (id_turno),
    INDEX idx_fecha (fecha_arqueo)
);

-- ==========================================================
-- 6. VENTAS FINALIZADAS
-- ==========================================================

-- Ventas completadas
CREATE TABLE ventas (
    id_venta INT PRIMARY KEY AUTO_INCREMENT,
    numero_venta VARCHAR(20) NOT NULL UNIQUE,
    id_pedido INT NOT NULL UNIQUE,
    id_turno INT NOT NULL,
    id_tipo_documento INT NOT NULL,
    id_bodega INT NOT NULL,
    
    -- Totales
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    iva DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Cliente
    nombre_cliente VARCHAR(100),
    rut_cliente VARCHAR(20),
    direccion_cliente TEXT,
    telefono_cliente VARCHAR(20),
    
    estado ENUM('completada', 'anulada') DEFAULT 'completada',
    observaciones TEXT,
    
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_turno) REFERENCES turnos_caja(id_turno),
    FOREIGN KEY (id_tipo_documento) REFERENCES tipos_documento(id_tipo_documento),
    FOREIGN KEY (id_bodega) REFERENCES bodegas(id_bodega),
    
    INDEX idx_numero_venta (numero_venta),
    INDEX idx_fecha (fecha_venta),
    INDEX idx_turno (id_turno),
    INDEX idx_tipo_documento (id_tipo_documento),
    INDEX idx_bodega (id_bodega),
    INDEX idx_estado (estado)
);

-- Pagos de ventas
CREATE TABLE pagos (
    id_pago INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    id_metodo_pago INT NOT NULL,
    
    monto DECIMAL(10,2) NOT NULL,
    referencia VARCHAR(100),
    
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_metodo_pago) REFERENCES metodos_pago(id_metodo),
    INDEX idx_venta (id_venta),
    INDEX idx_metodo (id_metodo_pago),
    INDEX idx_fecha (fecha_pago)
);

-- ==========================================================
-- 7. FUNCIONES PARA NUMERACIÓN DIARIA - ✅ CORREGIDAS
-- ==========================================================

DELIMITER $$

-- ✅ FUNCIÓN PRINCIPAL: Obtener próximo número diario
CREATE FUNCTION obtener_proximo_numero_diario() 
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_numero_diario INT DEFAULT 1;
    
    SELECT COALESCE(MAX(numero_diario), 0) + 1
    INTO v_numero_diario
    FROM pedidos 
    WHERE DATE(fecha_creacion) = CURDATE();
    
    RETURN v_numero_diario;
END$$

-- ✅ FUNCIÓN: Generar número completo de pedido
CREATE FUNCTION generar_numero_pedido_simple() 
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_numero_diario INT DEFAULT 1;
    DECLARE v_fecha VARCHAR(8);
    DECLARE v_numero_completo VARCHAR(20);
    
    SET v_fecha = DATE_FORMAT(NOW(), '%Y%m%d');
    
    -- Buscar último número del día
    SELECT COALESCE(MAX(numero_diario), 0) + 1
    INTO v_numero_diario
    FROM pedidos 
    WHERE DATE(fecha_creacion) = CURDATE();
    
    SET v_numero_completo = CONCAT('VP', v_fecha, '-', LPAD(v_numero_diario, 4, '0'));
    
    RETURN v_numero_completo;
END$$

-- ✅ FUNCIÓN: Generar número de venta (para cuando se complete el pago)
CREATE FUNCTION generar_numero_venta() 
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_numero INT DEFAULT 1;
    DECLARE v_fecha VARCHAR(8);
    DECLARE v_numero_completo VARCHAR(20);
    
    SET v_fecha = DATE_FORMAT(NOW(), '%Y%m%d');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_venta, 10) AS UNSIGNED)), 0) + 1
    INTO v_numero
    FROM ventas 
    WHERE numero_venta LIKE CONCAT('VT', v_fecha, '-%');
    
    SET v_numero_completo = CONCAT('VT', v_fecha, '-', LPAD(v_numero, 4, '0'));
    
    RETURN v_numero_completo;
END$$

-- ==========================================================
-- 8. OTRAS FUNCIONES ÚTILES
-- ==========================================================

-- Función: Obtener precio según modalidad y tipo de documento
CREATE FUNCTION obtener_precio_modalidad(
    p_id_modalidad INT, 
    p_tipo_precio ENUM('neto', 'factura', 'personalizado')
) 
RETURNS DECIMAL(10,0)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_precio DECIMAL(10,0) DEFAULT 0;
    
    IF p_tipo_precio != 'personalizado' THEN
        SELECT 
            CASE p_tipo_precio
                WHEN 'neto' THEN mp.precio_neto
                WHEN 'factura' THEN mp.precio_neto_factura
                ELSE mp.precio_neto
            END INTO v_precio
        FROM modalidades_producto mp
        WHERE mp.id_modalidad = p_id_modalidad
        AND mp.activa = TRUE;
    END IF;
    
    RETURN COALESCE(v_precio, 0);
END$$

-- Función: Calcular stock total de una variante
CREATE FUNCTION calcular_stock_total_variante(p_id_variante_producto INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_stock_total DECIMAL(10,2) DEFAULT 0;
    
    SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_stock_total
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante_producto;
    
    RETURN v_stock_total;
END$$

-- Función: Obtener stock en bodega específica
CREATE FUNCTION obtener_stock_en_bodega(
    p_id_variante_producto INT,
    p_id_bodega INT
)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_stock DECIMAL(10,2) DEFAULT 0;
    
    SELECT COALESCE(cantidad_disponible, 0) INTO v_stock
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante_producto 
    AND id_bodega = p_id_bodega;
    
    RETURN v_stock;
END$$

-- Función: Calcular dinero teórico de turno para arqueos
CREATE FUNCTION calcular_dinero_teorico_turno(p_id_turno INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_monto_inicial DECIMAL(10,2) DEFAULT 0;
    DECLARE v_total_ventas_efectivo DECIMAL(10,2) DEFAULT 0;
    DECLARE v_dinero_teorico DECIMAL(10,2) DEFAULT 0;
    
    -- Obtener monto inicial del turno
    SELECT COALESCE(monto_inicial, 0) 
    INTO v_monto_inicial
    FROM turnos_caja 
    WHERE id_turno = p_id_turno;
    
    -- Calcular total de ventas en efectivo del turno
    SELECT COALESCE(SUM(p.monto), 0)
    INTO v_total_ventas_efectivo
    FROM ventas v
    JOIN pagos p ON v.id_venta = p.id_venta
    JOIN metodos_pago mp ON p.id_metodo_pago = mp.id_metodo
    WHERE v.id_turno = p_id_turno
    AND v.estado = 'completada'
    AND mp.tipo = 'efectivo';
    
    SET v_dinero_teorico = v_monto_inicial + v_total_ventas_efectivo;
    
    RETURN v_dinero_teorico;
END$$

DELIMITER ;

-- ==========================================================
-- 9. TRIGGERS PARA AUTOMATIZACIÓN
-- ==========================================================
DELIMITER $$

-- Trigger: Crear modalidades automáticamente al crear variante
CREATE TRIGGER tr_crear_modalidades_variante
    AFTER INSERT ON variantes_producto
    FOR EACH ROW
BEGIN
    IF (SELECT COUNT(*) FROM modalidades_producto WHERE id_variante_producto = NEW.id_variante_producto) = 0 THEN
        CALL crear_modalidades_para_variante(NEW.id_variante_producto);
    END IF;
END$$

-- Trigger: Validar modalidad-variante y calcular subtotal
CREATE TRIGGER tr_detalle_pedidos_validacion
    BEFORE INSERT ON detalle_pedidos
    FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO v_count
    FROM modalidades_producto mp
    WHERE mp.id_modalidad = NEW.id_modalidad
    AND mp.id_variante_producto = NEW.id_variante_producto
    AND mp.activa = TRUE;
    
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'La modalidad seleccionada no pertenece a la variante del producto';
    END IF;
    
    SET NEW.subtotal = ROUND(NEW.cantidad * NEW.precio_unitario, 0);
END$$

CREATE TRIGGER tr_detalle_pedidos_validacion_update
    BEFORE UPDATE ON detalle_pedidos
    FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO v_count
    FROM modalidades_producto mp
    WHERE mp.id_modalidad = NEW.id_modalidad
    AND mp.id_variante_producto = NEW.id_variante_producto
    AND mp.activa = TRUE;
    
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'La modalidad seleccionada no pertenece a la variante del producto';
    END IF;
    
    SET NEW.subtotal = ROUND(NEW.cantidad * NEW.precio_unitario, 0);
END$$

-- Triggers para actualizar totales del pedido
CREATE TRIGGER actualizar_totales_pedido_insert
    AFTER INSERT ON detalle_pedidos
    FOR EACH ROW
BEGIN
    UPDATE pedidos 
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0) 
        FROM detalle_pedidos 
        WHERE id_pedido = NEW.id_pedido
    ),
    total = subtotal - descuento,
    fecha_actualizacion = NOW()
    WHERE id_pedido = NEW.id_pedido;
END$$

CREATE TRIGGER actualizar_totales_pedido_update
    AFTER UPDATE ON detalle_pedidos
    FOR EACH ROW
BEGIN
    UPDATE pedidos 
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0) 
        FROM detalle_pedidos 
        WHERE id_pedido = NEW.id_pedido
    ),
    total = subtotal - descuento,
    fecha_actualizacion = NOW()
    WHERE id_pedido = NEW.id_pedido;
END$$

CREATE TRIGGER actualizar_totales_pedido_delete
    AFTER DELETE ON detalle_pedidos
    FOR EACH ROW
BEGIN
    UPDATE pedidos 
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0) 
        FROM detalle_pedidos 
        WHERE id_pedido = OLD.id_pedido
    ),
    total = subtotal - descuento,
    fecha_actualizacion = NOW()
    WHERE id_pedido = OLD.id_pedido;
END$$

-- Trigger: Actualizar totales del turno cuando se crea una venta
CREATE TRIGGER actualizar_totales_turno_venta
    AFTER INSERT ON ventas
    FOR EACH ROW
BEGIN
    UPDATE turnos_caja 
    SET total_ventas = total_ventas + NEW.total,
        cantidad_ventas = cantidad_ventas + 1
    WHERE id_turno = NEW.id_turno;
END$$

-- Trigger: Calcular IVA automáticamente al crear venta
CREATE TRIGGER calcular_iva_venta
    BEFORE INSERT ON ventas
    FOR EACH ROW
BEGIN
    DECLARE v_aplica_iva BOOLEAN DEFAULT FALSE;
    
    SELECT aplica_iva INTO v_aplica_iva
    FROM tipos_documento 
    WHERE id_tipo_documento = NEW.id_tipo_documento;
    
    IF v_aplica_iva THEN
        SET NEW.iva = (NEW.subtotal - NEW.descuento) * 0.19;
        SET NEW.total = NEW.subtotal - NEW.descuento + NEW.iva;
    ELSE
        SET NEW.iva = 0;
        SET NEW.total = NEW.subtotal - NEW.descuento;
    END IF;
END$$

DELIMITER ;

-- ==========================================================
-- 10. VISTAS ÚTILES
-- ==========================================================

-- Vista productos completa con modalidades por variante
CREATE VIEW vista_productos_completa AS
SELECT 
    p.id_producto,
    p.codigo,
    p.nombre as producto_nombre,
    p.tipo as producto_tipo,
    p.descripcion as producto_descripcion,
    p.unidad_medida,
    c.nombre as categoria_nombre,
    
    vp.id_variante_producto,
    vp.sku,
    vp.color,
    vp.medida,
    vp.material,
    vp.descripcion as variante_descripcion,
    
    mp.id_modalidad,
    mp.nombre as modalidad_nombre,
    mp.descripcion as modalidad_descripcion,
    mp.cantidad_base,
    mp.es_cantidad_variable,
    mp.minimo_cantidad,
    mp.precio_costo,
    mp.precio_neto,
    mp.precio_neto_factura,
    mp.precio_con_iva,
    
    -- Descripción completa
    CASE 
        WHEN p.tipo IS NOT NULL THEN 
            CONCAT(p.tipo, ' ', p.nombre, 
                   CASE 
                       WHEN vp.color IS NOT NULL THEN CONCAT(' - ', vp.color)
                       WHEN vp.medida IS NOT NULL THEN CONCAT(' - Med. ', vp.medida)
                       ELSE ''
                   END)
        ELSE 
            CONCAT(p.nombre,
                   CASE 
                       WHEN vp.medida IS NOT NULL THEN CONCAT(' - Med. ', vp.medida)
                       WHEN vp.color IS NOT NULL THEN CONCAT(' - ', vp.color)
                       ELSE ''
                   END)
    END AS descripcion_completa
    
FROM productos p
JOIN categorias c ON p.id_categoria = c.id_categoria
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
JOIN modalidades_producto mp ON vp.id_variante_producto = mp.id_variante_producto
WHERE p.activo = TRUE 
AND vp.activo = TRUE 
AND mp.activa = TRUE;

-- ✅ VISTA: Pedidos con información de numeración diaria
CREATE VIEW vista_pedidos_con_numeracion AS
SELECT 
    p.id_pedido,
    p.numero_pedido,
    p.numero_diario,
    LPAD(p.numero_diario, 3, '0') AS numero_cliente_formateado,
    p.estado,
    p.tipo_documento,
    p.total,
    p.fecha_creacion,
    DATE(p.fecha_creacion) AS fecha_solo,
    TIME(p.fecha_creacion) AS hora_solo,
    DATEDIFF(CURDATE(), DATE(p.fecha_creacion)) AS dias_transcurridos,
    
    -- Información del vendedor
    u.usuario AS vendedor_usuario,
    u.nombre_completo AS vendedor_nombre,
    
    -- Información del cliente (si existe)
    c.nombre AS cliente_nombre,
    c.rut AS cliente_rut,
    
    -- Estado con número
    CASE p.estado
        WHEN 'vale_pendiente' THEN CONCAT('📋 Vale #', LPAD(p.numero_diario, 3, '0'), ' - Esperando en caja')
        WHEN 'procesando_caja' THEN CONCAT('⏳ Vale #', LPAD(p.numero_diario, 3, '0'), ' - Procesando pago')
        WHEN 'completado' THEN CONCAT('✅ Vale #', LPAD(p.numero_diario, 3, '0'), ' - Completado')
        WHEN 'cancelado' THEN CONCAT('❌ Vale #', LPAD(p.numero_diario, 3, '0'), ' - Cancelado')
        ELSE p.estado
    END AS estado_con_numero
    
FROM pedidos p
JOIN usuarios u ON p.id_vendedor = u.id_usuario
LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
ORDER BY p.fecha_creacion DESC, p.numero_diario DESC;



-- ==========================================================
-- 14. VERIFICACIÓN FINAL
-- ==========================================================

SELECT 
    '🎉 BASE DE DATOS SANTITELAS CREADA EXITOSAMENTE' AS resultado,
    CONCAT('✅ Productos: ', (SELECT COUNT(*) FROM productos)) AS productos_creados,
    CONCAT('✅ Variantes: ', (SELECT COUNT(*) FROM variantes_producto)) AS variantes_creadas,
    CONCAT('✅ Modalidades: ', (SELECT COUNT(*) FROM modalidades_producto)) AS modalidades_creadas,
    CONCAT('✅ Stocks: ', (SELECT COUNT(*) FROM stock_por_bodega)) AS registros_stock,
    NOW() AS fecha_creacion;

-- ✅ PROBAR LAS FUNCIONES DE NUMERACIÓN
SELECT 
    '🔢 PROBANDO FUNCIONES DE NUMERACIÓN DIARIA' AS titulo,
    obtener_proximo_numero_diario() AS proximo_numero_diario,
    generar_numero_pedido_simple() AS numero_completo_generado,
    generar_numero_venta() AS numero_venta_generado;

-- ✅ MOSTRAR ESTRUCTURA DE PRECIOS
SELECT 
    '📊 ESTRUCTURA DE PRECIOS POR VARIANTE' AS titulo;

SELECT 
    p.nombre AS PRODUCTO,
    COALESCE(p.tipo, '(Sin tipo)') AS TIPO,
    vp.color,
    vp.medida,
    mp.nombre AS MODALIDAD,
    mp.precio_neto AS PRECIO_NETO,
    mp.precio_neto_factura AS PRECIO_FACTURA,
    mp.precio_con_iva AS PRECIO_CON_IVA
FROM productos p
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
JOIN modalidades_producto mp ON vp.id_variante_producto = mp.id_variante_producto
WHERE p.activo = TRUE AND vp.activo = TRUE AND mp.activa = TRUE
ORDER BY p.nombre, vp.color, vp.medida, mp.nombre
LIMIT 10;

-- ✅ MOSTRAR RESUMEN DE NUMERACIÓN
SELECT 
    '📋 RESUMEN PARA NUMERACIÓN DIARIA' AS titulo;

SELECT 
    DATE(NOW()) AS fecha_hoy,
    'No hay pedidos aún' AS estado_actual,
    'VP' AS prefijo_vales,
    'VT' AS prefijo_ventas,
    'Los números diarios se reinician cada día' AS nota;

-- ==========================================================
-- 🔔 NOTA IMPORTANTE: 
-- Los PROCEDURES han sido movidos a: procedures_santitelas.sql
-- Para cargar la base de datos completa ejecutar:
-- 1. Este archivo primero (santitelas_sin_procedures.sql)
-- 2. Luego el archivo de procedures (procedures_santitelas.sql)
-- ==========================================================