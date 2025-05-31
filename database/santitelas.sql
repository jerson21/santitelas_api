-- ==========================================================
-- SANTITELAS - SISTEMA DE PUNTO DE VENTA
-- Base de datos completa organizada y optimizada
-- VERSIÓN ACTUALIZADA: MODALIDADES POR VARIANTE
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

-- Limpiar funciones y procedures existentes
DROP PROCEDURE IF EXISTS crear_modalidades_para_variante;
DROP FUNCTION IF EXISTS obtener_precio_modalidad;
DROP FUNCTION IF EXISTS calcular_stock_total_variante;
DROP FUNCTION IF EXISTS obtener_stock_en_bodega;
DROP FUNCTION IF EXISTS generar_numero_pedido;
DROP FUNCTION IF EXISTS generar_numero_venta;

-- Limpiar vistas existentes
DROP VIEW IF EXISTS vista_productos_completa;
DROP VIEW IF EXISTS vista_detalle_pedidos_completa;
DROP VIEW IF EXISTS vista_clientes_datos_pendientes;
DROP VIEW IF EXISTS vista_stock_productos;
DROP VIEW IF EXISTS vista_productos_por_tipo;

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
-- 4. GESTIÓN DE PEDIDOS Y VENTAS
-- ==========================================================

-- Pedidos (preventa/cotización)
CREATE TABLE pedidos (
    id_pedido INT PRIMARY KEY AUTO_INCREMENT,
    numero_pedido VARCHAR(20) NOT NULL UNIQUE,
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
    INDEX idx_vendedor (id_vendedor),
    INDEX idx_cliente (id_cliente),
    INDEX idx_estado (estado),
    INDEX idx_fecha_creacion (fecha_creacion),
    INDEX idx_tipo_documento (tipo_documento)
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
-- 7. FUNCIONES ÚTILES ACTUALIZADAS
-- ==========================================================

DELIMITER //

-- Función: Crear modalidades automáticamente para nueva variante (MEJORADA)
CREATE PROCEDURE crear_modalidades_para_variante(
    IN p_id_variante_producto INT
)
BEGIN
    DECLARE v_id_producto INT;
    DECLARE v_precio_costo_base DECIMAL(10,0);
    DECLARE v_precio_neto_base DECIMAL(10,0);
    DECLARE v_precio_neto_factura_base DECIMAL(10,0);
    DECLARE v_unidad_medida VARCHAR(20);
    DECLARE v_count INT DEFAULT 0;
    
    -- Verificar si ya existen modalidades para esta variante
    SELECT COUNT(*) INTO v_count
    FROM modalidades_producto 
    WHERE id_variante_producto = p_id_variante_producto;
    
    -- Solo crear si no existen modalidades
    IF v_count = 0 THEN
        -- Obtener datos del producto padre
        SELECT p.id_producto, 
               COALESCE(p.precio_costo_base, 0), 
               COALESCE(p.precio_neto_base, 0), 
               COALESCE(p.precio_neto_factura_base, 0), 
               COALESCE(p.unidad_medida, 'unidad')
        INTO v_id_producto, v_precio_costo_base, v_precio_neto_base, v_precio_neto_factura_base, v_unidad_medida
        FROM productos p
        JOIN variantes_producto vp ON p.id_producto = vp.id_producto
        WHERE vp.id_variante_producto = p_id_variante_producto;
        
        -- Crear modalidades según la unidad de medida
        IF v_unidad_medida = 'metro' THEN
            -- Para telas: METRO y ROLLO
            INSERT IGNORE INTO modalidades_producto (id_variante_producto, nombre, descripcion, cantidad_base, es_cantidad_variable, minimo_cantidad, precio_costo, precio_neto, precio_neto_factura)
            VALUES 
                (p_id_variante_producto, 'METRO', 'Venta al corte por metro', 1, TRUE, 0.1, v_precio_costo_base, v_precio_neto_base, v_precio_neto_factura_base),
                (p_id_variante_producto, 'ROLLO', 'Rollo completo', 25, FALSE, 25, ROUND(v_precio_costo_base * 0.9), ROUND(v_precio_neto_base * 0.9), ROUND(v_precio_neto_factura_base * 0.9));
        
        ELSEIF v_unidad_medida = 'unidad' THEN
            -- Para productos unitarios: UNIDAD y EMBALAJE/SET
            INSERT IGNORE INTO modalidades_producto (id_variante_producto, nombre, descripcion, cantidad_base, es_cantidad_variable, minimo_cantidad, precio_costo, precio_neto, precio_neto_factura)
            VALUES 
                (p_id_variante_producto, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, v_precio_costo_base, v_precio_neto_base, v_precio_neto_factura_base),
                (p_id_variante_producto, 'EMBALAJE', 'Embalaje completo', 10, FALSE, 10, ROUND(v_precio_costo_base * 0.85), ROUND(v_precio_neto_base * 0.85), ROUND(v_precio_neto_factura_base * 0.85));
        
        ELSE
            -- Por defecto: solo UNIDAD
            INSERT IGNORE INTO modalidades_producto (id_variante_producto, nombre, descripcion, cantidad_base, es_cantidad_variable, minimo_cantidad, precio_costo, precio_neto, precio_neto_factura)
            VALUES (p_id_variante_producto, 'UNIDAD', 'Venta por unidad', 1, FALSE, 1, v_precio_costo_base, v_precio_neto_base, v_precio_neto_factura_base);
        END IF;
    END IF;
END//

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
END//

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
END//

-- Función: Generar número de pedido automático
CREATE FUNCTION generar_numero_pedido() 
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_numero INT DEFAULT 1;
    DECLARE v_fecha VARCHAR(8);
    DECLARE v_numero_completo VARCHAR(20);
    
    SET v_fecha = DATE_FORMAT(NOW(), '%Y%m%d');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido, 10) AS UNSIGNED)), 0) + 1
    INTO v_numero
    FROM pedidos 
    WHERE numero_pedido LIKE CONCAT(v_fecha, '-%');
    
    SET v_numero_completo = CONCAT(v_fecha, '-', LPAD(v_numero, 4, '0'));
    
    RETURN v_numero_completo;
END//

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
END//

-- Función: Generar número de venta automático
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
    WHERE numero_venta LIKE CONCAT(v_fecha, '-%');
    
    SET v_numero_completo = CONCAT(v_fecha, '-', LPAD(v_numero, 4, '0'));
    
    RETURN v_numero_completo;
END//

DELIMITER ;

-- ==========================================================
-- 8. TRIGGERS ACTUALIZADOS
-- ==========================================================

DELIMITER //

-- Trigger: Crear modalidades automáticamente al crear variante (CON VALIDACIONES)
CREATE TRIGGER tr_crear_modalidades_variante
    AFTER INSERT ON variantes_producto
    FOR EACH ROW
BEGIN
    -- Solo crear modalidades si no existen ya
    IF (SELECT COUNT(*) FROM modalidades_producto WHERE id_variante_producto = NEW.id_variante_producto) = 0 THEN
        CALL crear_modalidades_para_variante(NEW.id_variante_producto);
    END IF;
END//

-- Trigger: Validar modalidad-variante y calcular subtotal
CREATE TRIGGER tr_detalle_pedidos_validacion
    BEFORE INSERT ON detalle_pedidos
    FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    
    -- Validar que la modalidad pertenezca a la variante seleccionada
    SELECT COUNT(*) INTO v_count
    FROM modalidades_producto mp
    WHERE mp.id_modalidad = NEW.id_modalidad
    AND mp.id_variante_producto = NEW.id_variante_producto
    AND mp.activa = TRUE;
    
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'La modalidad seleccionada no pertenece a la variante del producto';
    END IF;
    
    -- Calcular subtotal
    SET NEW.subtotal = ROUND(NEW.cantidad * NEW.precio_unitario, 0);
END//

CREATE TRIGGER tr_detalle_pedidos_validacion_update
    BEFORE UPDATE ON detalle_pedidos
    FOR EACH ROW
BEGIN
    DECLARE v_count INT DEFAULT 0;
    
    -- Validar que la modalidad pertenezca a la variante seleccionada
    SELECT COUNT(*) INTO v_count
    FROM modalidades_producto mp
    WHERE mp.id_modalidad = NEW.id_modalidad
    AND mp.id_variante_producto = NEW.id_variante_producto
    AND mp.activa = TRUE;
    
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'La modalidad seleccionada no pertenece a la variante del producto';
    END IF;
    
    -- Calcular subtotal
    SET NEW.subtotal = ROUND(NEW.cantidad * NEW.precio_unitario, 0);
END//

-- Trigger: Actualizar totales del pedido cuando se agrega detalle
CREATE TRIGGER actualizar_totales_pedido
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
END//

-- Trigger: Actualizar totales del pedido cuando se actualiza detalle
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
END//

-- Trigger: Actualizar totales del pedido cuando se elimina detalle
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
END//

-- Trigger: Actualizar totales del turno cuando se crea una venta
CREATE TRIGGER actualizar_totales_turno_venta
    AFTER INSERT ON ventas
    FOR EACH ROW
BEGIN
    UPDATE turnos_caja 
    SET total_ventas = total_ventas + NEW.total,
        cantidad_ventas = cantidad_ventas + 1
    WHERE id_turno = NEW.id_turno;
END//

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
END//

DELIMITER ;

-- ==========================================================
-- 9. VISTAS ACTUALIZADAS
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

-- Vista detalle pedidos completa
CREATE VIEW vista_detalle_pedidos_completa AS
SELECT 
    dp.id_detalle,
    dp.id_pedido,
    dp.cantidad,
    dp.precio_unitario,
    dp.tipo_precio,
    dp.subtotal,
    dp.observaciones as detalle_observaciones,
    dp.precio_autorizado_por,
    dp.motivo_precio_personalizado,
    
    -- Información del pedido
    p.numero_pedido,
    p.estado as pedido_estado,
    p.tipo_documento,
    
    -- Información de la modalidad
    mp.id_modalidad,
    mp.nombre as modalidad_nombre,
    mp.descripcion as modalidad_descripcion,
    mp.cantidad_base,
    mp.es_cantidad_variable,
    mp.precio_costo,
    mp.precio_neto,
    mp.precio_neto_factura,
    mp.precio_con_iva,
    
    -- Información de la variante
    vp.id_variante_producto,
    vp.sku,
    vp.color,
    vp.medida,
    vp.material,
    vp.descripcion as variante_descripcion,
    
    -- Información del producto
    pr.id_producto,
    pr.codigo as producto_codigo,
    pr.nombre as producto_nombre,
    pr.tipo as producto_tipo,
    pr.descripcion as producto_descripcion,
    pr.unidad_medida,
    
    -- Información del vendedor
    u.nombre_completo as vendedor_nombre,
    
    -- Información del cliente (si existe)
    c.nombre as cliente_nombre,
    c.rut as cliente_rut,
    
    -- Usuario que autorizó precio personalizado (si aplica)
    ua.nombre_completo as precio_autorizado_por_nombre    
    
FROM detalle_pedidos dp
JOIN pedidos p ON dp.id_pedido = p.id_pedido
JOIN variantes_producto vp ON dp.id_variante_producto = vp.id_variante_producto
JOIN productos pr ON vp.id_producto = pr.id_producto
JOIN modalidades_producto mp ON dp.id_modalidad = mp.id_modalidad
JOIN usuarios u ON p.id_vendedor = u.id_usuario
LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
LEFT JOIN usuarios ua ON dp.precio_autorizado_por = ua.id_usuario;

-- Vista clientes con datos pendientes
CREATE VIEW vista_clientes_datos_pendientes AS
SELECT 
    c.id_cliente,
    c.rut,
    c.tipo_cliente,
    c.nombre,
    c.razon_social,
    c.datos_completos,
    COUNT(p.id_pedido) AS facturas_pendientes,
    SUM(p.total) AS monto_pendiente,
    MIN(p.fecha_creacion) AS primera_factura_pendiente
FROM clientes c
INNER JOIN pedidos p ON p.id_cliente = c.id_cliente
WHERE p.estado = 'pagado_datos_pendientes'
  AND p.tipo_documento = 'factura'
  AND c.datos_completos = FALSE
GROUP BY c.id_cliente
ORDER BY primera_factura_pendiente ASC;

-- Vista stock por productos
CREATE VIEW vista_stock_productos AS
SELECT 
    p.id_producto,
    p.codigo,
    p.nombre as producto_nombre,
    p.tipo as producto_tipo,
    vp.id_variante_producto,
    vp.sku,
    vp.color,
    vp.medida,
    vp.material,
    b.id_bodega,
    b.nombre as bodega_nombre,
    spb.cantidad_disponible,
    spb.cantidad_reservada,
    spb.stock_minimo,
    spb.stock_maximo,
    spb.fecha_actualizacion,
    
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
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
JOIN stock_por_bodega spb ON vp.id_variante_producto = spb.id_variante_producto
JOIN bodegas b ON spb.id_bodega = b.id_bodega
WHERE p.activo = TRUE AND vp.activo = TRUE AND b.activa = TRUE
ORDER BY p.tipo, p.nombre, vp.color, vp.medida, b.nombre;

-- Vista productos organizados por tipo
CREATE VIEW vista_productos_por_tipo AS
SELECT 
    c.nombre AS categoria,
    COALESCE(p.tipo, 'SIN TIPO') AS tipo_producto,
    p.nombre AS linea_marca,
    COUNT(DISTINCT vp.id_variante_producto) AS total_variantes,
    COUNT(DISTINCT mp.id_modalidad) AS total_modalidades,
    COALESCE(SUM(spb.cantidad_disponible), 0) AS stock_total,
    MIN(mp.precio_neto) AS precio_minimo,
    MAX(mp.precio_neto) AS precio_maximo
FROM categorias c
JOIN productos p ON c.id_categoria = p.id_categoria
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
JOIN modalidades_producto mp ON vp.id_variante_producto = mp.id_variante_producto
LEFT JOIN stock_por_bodega spb ON vp.id_variante_producto = spb.id_variante_producto
WHERE p.activo = TRUE AND vp.activo = TRUE AND mp.activa = TRUE
GROUP BY c.nombre, p.tipo, p.nombre
ORDER BY c.nombre, p.tipo, p.nombre;

-- ==========================================================
-- 10. DATOS INICIALES
-- ==========================================================

-- Roles del sistema
INSERT INTO roles (nombre, descripcion, permisos) VALUES
('ADMINISTRADOR', 'Acceso completo al sistema', '["admin", "ventas", "productos", "usuarios"]'),
('CAJERO', 'Acceso a ventas y caja', '["ventas", "pagos"]'),
('VENDEDOR', 'Acceso a pedidos y productos', '["pedidos", "productos.ver"]');

-- Usuario administrador (password: admin123)
INSERT INTO usuarios (usuario, password_hash, nombre_completo, email, id_rol) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye1jrwtMNOySDEb8K9yJ3TksE7nQP/nOa', 'Administrador del Sistema', 'admin@santitelas.cl', 1);

-- Categorías de productos
INSERT INTO categorias (nombre, descripcion) VALUES
('TELAS', 'Diferentes tipos de telas y materiales'),
('BOTONES', 'Botones de diferentes tipos y tamaños'),
('PATAS', 'Patas y accesorios de costura'),
('CORCHETES', 'Corchetes metálicos de diferentes medidas'),
('HILOS', 'Hilos y elementos de bordado');

-- Tipos de documento
INSERT INTO tipos_documento (nombre, codigo, requiere_rut_cliente, es_fiscal, aplica_iva) VALUES
('Ticket', 'TIC', FALSE, FALSE, FALSE),
('Boleta', 'BOL', FALSE, TRUE, FALSE),
('Factura', 'FAC', TRUE, TRUE, TRUE);

-- Bodegas
INSERT INTO bodegas (codigo, nombre, descripcion, es_punto_venta) VALUES
('SALA', 'Sala de Ventas', 'Punto de venta principal', TRUE),
('BOD1', 'Bodega Principal', 'Bodega Temuco', FALSE),
('BOD2', 'Bodega Secundaria', 'Bodega Lirquen', FALSE);

-- Métodos de pago
INSERT INTO metodos_pago (nombre, codigo, tipo, requiere_referencia) VALUES
('Efectivo', 'EFE', 'efectivo', FALSE),
('Tarjeta Débito', 'DEB', 'tarjeta', TRUE),
('Tarjeta Crédito', 'CRE', 'tarjeta', TRUE),
('Transferencia', 'TRA', 'transferencia', TRUE);

-- Cajas registradoras
INSERT INTO cajas (nombre, ubicacion, activa) VALUES
('Caja Principal', 'Mostrador Principal', TRUE),
('Caja 1', 'Meson 1', TRUE),
('Caja 2', 'Meson 2', TRUE),
('Caja 3', 'Meson 3', TRUE),
('Caja Secundaria', 'Mostrador Auxiliar', TRUE);

-- ==========================================================
-- PRODUCTOS DE EJEMPLO CON NUEVA ESTRUCTURA
-- ==========================================================

-- PRODUCTOS BASE CON PLANTILLAS DE PRECIOS
INSERT INTO productos (codigo, nombre, descripcion, id_categoria, tipo, unidad_medida, precio_costo_base, precio_neto_base, precio_neto_factura_base) VALUES
-- TELAS (precios iguales para todas las variantes)
('LIN-GUCCI-001', 'GUCCI', 'Línea GUCCI de telas de lino premium', 1, 'LINO', 'metro', 2500, 3800, 3193),
('LIN-VERSACE-001', 'VERSACE', 'Línea VERSACE de telas de lino', 1, 'LINO', 'metro', 2300, 3500, 2941),
('FEL-PREMIUM-001', 'PREMIUM', 'Línea premium de felpa suave', 1, 'FELPA', 'metro', 1800, 2500, 2101),

-- OTROS PRODUCTOS ADICIONALES
('ACC-BOT-001', 'Botones Clásicos', 'Botones básicos para confección', 2, NULL, 'unidad', 100, 150, 126),
('HIL-ALG-001', 'Hilo Algodón', 'Hilo de algodón para costura', 5, NULL, 'unidad', 300, 450, 378),
('PAT-MAD-001', 'Pata Madera', 'Patas de madera para muebles', 3, 'MADERA', 'unidad', 500, 800, 672);

-- VARIANTES DE PRODUCTOS
INSERT INTO variantes_producto (id_producto, sku, color, medida, descripcion) VALUES
-- LINO GUCCI - Todos heredarán el mismo precio
(1, 'LIN-GUCCI-BLA', 'Blanco', NULL, 'Lino Gucci color Blanco'),
(1, 'LIN-GUCCI-NEG', 'Negro', NULL, 'Lino Gucci color Negro'),
(1, 'LIN-GUCCI-AZU', 'Azul', NULL, 'Lino Gucci color Azul'),
(1, 'LIN-GUCCI-ROJ', 'Rojo', NULL, 'Lino Gucci color Rojo'),
(1, 'LIN-GUCCI-VER', 'Verde', NULL, 'Lino Gucci color Verde'),

-- LINO VERSACE
(2, 'LIN-VERSACE-BLA', 'Blanco', NULL, 'Lino Versace color Blanco'),
(2, 'LIN-VERSACE-NEG', 'Negro', NULL, 'Lino Versace color Negro'),
(2, 'LIN-VERSACE-DOR', 'Dorado', NULL, 'Lino Versace color Dorado'),

-- FELPA PREMIUM  
(3, 'FEL-PREMIUM-GRI', 'Gris', NULL, 'Felpa premium color Gris'),
(3, 'FEL-PREMIUM-AZU', 'Azul', NULL, 'Felpa premium color Azul'),

-- CORCHETES - Cada medida tendrá precio diferente
(4, 'COR-71', NULL, '71', 'Corchete medida 71'),
(4, 'COR-12', NULL, '12', 'Corchete medida 12'),
(4, 'COR-1445', NULL, '1445', 'Corchete medida 1445'),
(4, 'COR-1450', NULL, '1450', 'Corchete medida 1450'),
(4, 'COR-8012', NULL, '8012', 'Corchete medida 8012'),

-- OTROS PRODUCTOS
(5, 'ACC-BOT-NE', 'Negro', NULL, 'Botones negros clásicos'),
(5, 'ACC-BOT-BL', 'Blanco', NULL, 'Botones blancos clásicos'),
(6, 'HIL-ALG-BL', 'Blanco', NULL, 'Hilo algodón blanco'),
(6, 'HIL-ALG-NE', 'Negro', NULL, 'Hilo algodón negro'),
(7, 'PAT-MAD-NAT', 'Natural', NULL, 'Pata madera natural'),
(7, 'PAT-MAD-TEÑ', 'Teñida', NULL, 'Pata madera teñida');

-- Cliente ejemplo
INSERT INTO clientes (rut, tipo_cliente, nombre, datos_completos) VALUES
('12345678-9', 'empresa', 'Cliente por completar datos', FALSE);

-- ==========================================================
-- FINALIZACIÓN Y VERIFICACIÓN
-- ==========================================================

SELECT 
    'Base de datos SANTITELAS con modalidades por variante creada exitosamente' AS resultado,
    CONCAT('Productos: ', (SELECT COUNT(*) FROM productos)) AS productos_creados,
    CONCAT('Variantes: ', (SELECT COUNT(*) FROM variantes_producto)) AS variantes_creadas,
    CONCAT('Modalidades: ', (SELECT COUNT(*) FROM modalidades_producto)) AS modalidades_creadas,
    NOW() AS fecha_creacion;

-- ==========================================================
-- AJUSTES DE PRECIOS ESPECÍFICOS (después de la creación inicial)
-- ==========================================================

-- Actualizar precios específicos para corchetes (diferentes por medida)
UPDATE modalidades_producto mp
JOIN variantes_producto vp ON mp.id_variante_producto = vp.id_variante_producto
SET 
    mp.precio_costo = CASE vp.medida
        WHEN '71' THEN 85
        WHEN '12' THEN 90
        WHEN '1445' THEN 120
        WHEN '1450' THEN 125
        WHEN '8012' THEN 140
        ELSE mp.precio_costo
    END,
    mp.precio_neto = CASE vp.medida
        WHEN '71' THEN 160
        WHEN '12' THEN 170
        WHEN '1445' THEN 220
        WHEN '1450' THEN 230
        WHEN '8012' THEN 250
        ELSE mp.precio_neto
    END,
    mp.precio_neto_factura = CASE vp.medida
        WHEN '71' THEN 134
        WHEN '12' THEN 143
        WHEN '1445' THEN 185
        WHEN '1450' THEN 193
        WHEN '8012' THEN 210
        ELSE mp.precio_neto_factura
    END
WHERE vp.medida IN ('71', '12', '1445', '1450', '8012');

-- Crear oferta especial para GUCCI Rojo (ejemplo de precio personalizado)
UPDATE modalidades_producto mp
JOIN variantes_producto vp ON mp.id_variante_producto = vp.id_variante_producto
SET 
    mp.precio_neto = 3200,  -- Descuento de $600
    mp.precio_neto_factura = 2689
WHERE vp.color = 'Rojo' AND vp.sku = 'LIN-GUCCI-ROJ';

-- Ajustar precios para modalidades EMBALAJE de corchetes (descuento por cantidad)
UPDATE modalidades_producto mp
JOIN variantes_producto vp ON mp.id_variante_producto = vp.id_variante_producto
SET 
    mp.precio_costo = CASE vp.medida
        WHEN '71' THEN 75
        WHEN '12' THEN 80
        WHEN '1445' THEN 105
        WHEN '1450' THEN 110
        WHEN '8012' THEN 125
        ELSE mp.precio_costo
    END,
    mp.precio_neto = CASE vp.medida
        WHEN '71' THEN 140
        WHEN '12' THEN 150
        WHEN '1445' THEN 190
        WHEN '1450' THEN 200
        WHEN '8012' THEN 220
        ELSE mp.precio_neto
    END,
    mp.precio_neto_factura = CASE vp.medida
        WHEN '71' THEN 118
        WHEN '12' THEN 126
        WHEN '1445' THEN 160
        WHEN '1450' THEN 168
        WHEN '8012' THEN 185
        ELSE mp.precio_neto_factura
    END
WHERE vp.medida IN ('71', '12', '1445', '1450', '8012') AND mp.nombre = 'EMBALAJE';

-- Ejemplo: Promoción especial para hilos negros
UPDATE modalidades_producto mp
JOIN variantes_producto vp ON mp.id_variante_producto = vp.id_variante_producto
JOIN productos p ON vp.id_producto = p.id_producto
SET 
    mp.precio_neto = 380,  -- Descuento de $70
    mp.precio_neto_factura = 319
WHERE vp.color = 'Negro' AND p.codigo = 'HIL-ALG-001';

-- Verificar estructura de precios
SELECT 
    '=== VERIFICACIÓN DE PRECIOS POR VARIANTE ===' AS titulo;

SELECT 
    p.nombre AS PRODUCTO,
    COALESCE(p.tipo, '(Sin tipo)') AS TIPO,
    vp.color,
    vp.medida,
    mp.nombre AS MODALIDAD,
    mp.precio_neto AS PRECIO_NETO,
    mp.precio_neto_factura AS PRECIO_FACTURA
FROM productos p
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
JOIN modalidades_producto mp ON vp.id_variante_producto = mp.id_variante_producto
WHERE p.activo = TRUE AND vp.activo = TRUE AND mp.activa = TRUE
ORDER BY p.nombre, vp.color, vp.medida, mp.nombre;