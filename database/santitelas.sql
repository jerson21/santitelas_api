-- ==========================================================
-- SANTITELAS - SISTEMA DE PUNTO DE VENTA
-- Base de datos completa organizada y optimizada
-- VERSIÓN ACTUALIZADA CON CAMPO TIPO
-- ==========================================================

CREATE DATABASE IF NOT EXISTS santitelas;
USE santitelas;

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
-- 2. GESTIÓN DE PRODUCTOS - ACTUALIZADA CON CAMPO TIPO
-- ==========================================================

-- Productos base
CREATE TABLE productos (
    id_producto INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    id_categoria INT NOT NULL,
    tipo VARCHAR(50) NULL,                      -- NUEVO: LINO, FELPA, ECO CUERO, etc.
    stock_minimo_total DECIMAL(10,2) DEFAULT 0,
    unidad_medida ENUM('metro', 'unidad', 'kilogramo', 'litros') DEFAULT 'unidad',
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
    INDEX idx_categoria (id_categoria),
    INDEX idx_tipo (tipo),                      -- NUEVO ÍNDICE
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

-- Modalidades de venta (por metro, por rollo, sets, etc.)
CREATE TABLE modalidades_producto (
    id_modalidad INT PRIMARY KEY AUTO_INCREMENT,
    id_producto INT NOT NULL,
    nombre VARCHAR(50) NOT NULL,                    -- "Por metro", "Set de 4", "Embalaje 30"
    descripcion VARCHAR(100),                       -- "4 patas juego completo"
    cantidad_base DECIMAL(10,2) NOT NULL,           -- 1, 4, 30
    es_cantidad_variable BOOLEAN DEFAULT FALSE,     -- TRUE para metros/rollos variables
    minimo_cantidad DECIMAL(10,2) DEFAULT 0,        -- Para rollos mínimo 30m
    
    -- Precios (en pesos chilenos CLP)
    precio_costo DECIMAL(10,0) DEFAULT 0,           -- Costo interno
    precio_neto DECIMAL(10,0) NOT NULL,             -- Precio para tickets/comunicación interna
    precio_neto_factura DECIMAL(10,0) NOT NULL,     -- Precio que aparece en factura (puede ser menor)
    
    -- Precio final calculado (con IVA sobre precio_neto_factura)
    precio_con_iva DECIMAL(10,0) GENERATED ALWAYS AS (ROUND(precio_neto_factura * 1.19, 0)) STORED,
    
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_producto (id_producto),
    INDEX idx_activa (activa),
    INDEX idx_precio_neto (precio_neto),
    UNIQUE KEY unique_producto_modalidad(id_producto, nombre)

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
    datos_completos BOOLEAN DEFAULT FALSE,  -- Para saber si faltan datos
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
-- 7. FUNCIONES ÚTILES
-- ==========================================================

DELIMITER //

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
    
    -- Solo aplica para precios estándar, no personalizado
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
-- 8. TRIGGERS DE VALIDACIÓN Y CÁLCULO
-- ==========================================================

DELIMITER //

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
-- 9. VISTAS ÚTILES ACTUALIZADAS
-- ==========================================================

-- Vista productos completa con TIPO incluido
CREATE VIEW vista_productos_completa AS
SELECT 
    p.id_producto,
    p.codigo,
    p.nombre as producto_nombre,
    p.tipo as producto_tipo,                    -- NUEVO
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
    
    -- Descripción completa para mostrar
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
    pr.tipo as producto_tipo,                   -- NUEVO
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

-- Vista stock por productos ACTUALIZADA
CREATE VIEW vista_stock_productos AS
SELECT 
    p.id_producto,
    p.codigo,
    p.nombre as producto_nombre,
    p.tipo as producto_tipo,                    -- NUEVO
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

-- NUEVA VISTA: Productos organizados por tipo
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
-- 10. DATOS INICIALES ACTUALIZADOS
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
-- PRODUCTOS DE EJEMPLO ACTUALIZADOS
-- ==========================================================

-- PRODUCTOS BASE con campo TIPO
INSERT INTO productos (codigo, nombre, descripcion, id_categoria, tipo, unidad_medida) VALUES
-- TELAS CON TIPO
('LIN-GUCCI-001', 'GUCCI', 'Línea GUCCI de telas de lino premium', 1, 'LINO', 'metro'),
('LIN-VERSACE-001', 'VERSACE', 'Línea VERSACE de telas de lino', 1, 'LINO', 'metro'),
('FEL-PREMIUM-001', 'PREMIUM', 'Línea premium de felpa suave', 1, 'FELPA', 'metro'),
('ECO-LUXURY-001', 'LUXURY', 'Línea luxury de eco cuero', 1, 'ECO CUERO', 'metro'),

-- CORCHETES SIN TIPO (solo nombre genérico)
('COR-001', 'CORCHETES', 'Corchetes metálicos en diferentes medidas', 4, NULL, 'unidad'),

-- OTROS PRODUCTOS
('ACC-BOT-001', 'Botones Clásicos', 'Botones básicos para confección', 2, NULL, 'unidad'),
('HIL-ALG-001', 'Hilo Algodón', 'Hilo de algodón para costura', 5, NULL, 'unidad');

-- VARIANTES DE PRODUCTOS
INSERT INTO variantes_producto (id_producto, sku, color, medida, descripcion) VALUES
-- LINO GUCCI - Diferentes colores
(1, 'LIN-GUCCI-BLANCO', 'Blanco', NULL, 'Lino Gucci color blanco'),
(1, 'LIN-GUCCI-NEGRO', 'Negro', NULL, 'Lino Gucci color negro'),
(1, 'LIN-GUCCI-AZUL', 'Azul', NULL, 'Lino Gucci color azul'),
(1, 'LIN-GUCCI-ROJO', 'Rojo', NULL, 'Lino Gucci color rojo'),
(1, 'LIN-GUCCI-VERDE', 'Verde', NULL, 'Lino Gucci color verde'),

-- LINO VERSACE - Diferentes colores
(2, 'LIN-VERSACE-BLANCO', 'Blanco', NULL, 'Lino Versace color blanco'),
(2, 'LIN-VERSACE-NEGRO', 'Negro', NULL, 'Lino Versace color negro'),
(2, 'LIN-VERSACE-DORADO', 'Dorado', NULL, 'Lino Versace color dorado'),

-- FELPA PREMIUM
(3, 'FEL-PREMIUM-GRIS', 'Gris', NULL, 'Felpa premium color gris'),
(3, 'FEL-PREMIUM-AZUL', 'Azul', NULL, 'Felpa premium color azul'),

-- ECO CUERO LUXURY
(4, 'ECO-LUXURY-MARRON', 'Marrón', NULL, 'Eco cuero luxury color marrón'),
(4, 'ECO-LUXURY-NEGRO', 'Negro', NULL, 'Eco cuero luxury color negro'),

-- CORCHETES - Diferentes medidas (SIN color)
(5, 'COR-71', NULL, '71', 'Corchete medida 71'),
(5, 'COR-12', NULL, '12', 'Corchete medida 12'),
(5, 'COR-1445', NULL, '1445', 'Corchete medida 1445'),
(5, 'COR-1450', NULL, '1450', 'Corchete medida 1450'),
(5, 'COR-8012', NULL, '8012', 'Corchete medida 8012'),

-- OTROS PRODUCTOS
(6, 'ACC-BOT-NE', 'Negro', NULL, 'Botones negros clásicos'),
(7, 'HIL-ALG-BL', 'Blanco', NULL, 'Hilo algodón blanco');

-- MODALIDADES DE PRODUCTOS
INSERT INTO modalidades_producto (
    id_producto, nombre, descripcion, cantidad_base, es_cantidad_variable, minimo_cantidad, precio_costo, precio_neto, precio_neto_factura
) VALUES
-- LINO GUCCI (id_producto = 1) - Por metro y rollo
(1, 'metro', 'Venta al corte por metro', 1, TRUE, 0.1, 2500, 3800, 3193),
(1, 'Rollo', 'Rollo completo de 30 metros', 30, FALSE, 30, 2200, 3500, 2941),

-- LINO VERSACE (id_producto = 2)
(2, 'metro', 'Venta al corte por metro', 1, TRUE, 0.1, 2300, 3500, 2941),
(2, 'Rollo', 'Rollo completo de 25 metros', 25, FALSE, 25, 2100, 3200, 2689),

-- FELPA PREMIUM (id_producto = 3)
(3, 'metro', 'Venta al corte por metro', 1, TRUE, 0.1, 1800, 2500, 2101),
(3, 'Rollo', 'Rollo completo de 15 metros', 15, FALSE, 15, 1700, 2200, 1849),

-- ECO CUERO LUXURY (id_producto = 4)
(4, 'metro', 'Venta al corte por metro', 1, TRUE, 0.1, 3500, 5200, 4370),
(4, 'Rollo', 'Rollo completo de 20 metros', 20, FALSE, 20, 3200, 4900, 4118),

-- CORCHETES (id_producto = 5)
(5, 'Unidad', 'Corchete individual', 1, FALSE, 1, 80, 150, 126),
(5, 'embalaje', 'Pack de 20 cajas', 10, FALSE, 10, 75, 140, 118),

-- BOTONES CLÁSICOS (id_producto = 6)
(6, 'Unidad', '1 botón', 1, FALSE, 1, 100, 150, 126),
(6, 'Pack 10', '10 botones', 10, FALSE, 10, 90, 130, 109),

-- HILO ALGODÓN (id_producto = 7)
(7, 'Unidad', '1 rollo hilo', 1, FALSE, 1, 300, 450, 378);
-- STOCK INICIAL
INSERT INTO stock_por_bodega (id_variante_producto, id_bodega, cantidad_disponible, stock_minimo) VALUES
-- LINO GUCCI
(1, 1, 25.5, 5.0), (1, 2, 45.8, 15.0), (1, 3, 20.3, 8.0),
(2, 1, 18.2, 5.0), (2, 2, 38.5, 15.0), (2, 3, 15.8, 8.0),
(3, 1, 22.1, 5.0), (3, 2, 42.3, 15.0), (3, 3, 18.5, 8.0),
(4, 1, 16.8, 5.0), (4, 2, 35.2, 15.0), (4, 3, 12.8, 8.0),
(5, 1, 28.3, 5.0), (5, 2, 48.5, 15.0), (5, 3, 22.8, 8.0),

-- LINO VERSACE
(6, 1, 15.5, 4.0), (6, 2, 32.8, 12.0), (6, 3, 18.2, 6.0),
(7, 1, 12.3, 4.0), (7, 2, 28.5, 12.0), (7, 3, 15.8, 6.0),
(8, 1, 8.5, 3.0), (8, 2, 18.2, 8.0), (8, 3, 10.5, 4.0),

-- FELPA PREMIUM
(9, 1, 35.2, 8.0), (9, 2, 65.8, 20.0), (9, 3, 28.5, 10.0),
(10, 1, 28.8, 8.0), (10, 2, 55.2, 20.0), (10, 3, 22.8, 10.0),

-- ECO CUERO LUXURY
(11, 1, 12.5, 3.0), (11, 2, 25.8, 8.0), (11, 3, 15.2, 5.0),
(12, 1, 8.8, 3.0), (12, 2, 18.5, 8.0), (12, 3, 10.8, 5.0),

-- CORCHETES
(13, 1, 150, 30), (13, 2, 500, 100), (13, 3, 250, 50),
(14, 1, 200, 40), (14, 2, 800, 150), (14, 3, 350, 70),
(15, 1, 85, 20), (15, 2, 320, 80), (15, 3, 150, 40),
(16, 1, 95, 25), (16, 2, 380, 90), (16, 3, 180, 45),
(17, 1, 45, 15), (17, 2, 180, 50), (17, 3, 80, 25),

-- OTROS
(18, 1, 85, 20), (18, 2, 320, 80), (18, 3, 150, 40),
(19, 1, 65, 20), (19, 2, 240, 60), (19, 3, 120, 30);

-- Cliente ejemplo
INSERT INTO clientes (rut, tipo_cliente, nombre, datos_completos) VALUES
('12345678-9', 'empresa', 'Cliente por completar datos', FALSE);

-- ==========================================================
-- FINALIZACIÓN Y VERIFICACIÓN
-- ==========================================================

SELECT 
    'Base de datos SANTITELAS actualizada exitosamente' AS resultado,
    CONCAT('Productos: ', (SELECT COUNT(*) FROM productos)) AS productos_creados,
    CONCAT('Variantes: ', (SELECT COUNT(*) FROM variantes_producto)) AS variantes_creadas,
    CONCAT('Modalidades: ', (SELECT COUNT(*) FROM modalidades_producto)) AS modalidades_creadas,
    CONCAT('Tipos documento: ', (SELECT COUNT(*) FROM tipos_documento)) AS tipos_documento,
    CONCAT('Funciones: ', (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'santitelas' AND ROUTINE_TYPE = 'FUNCTION')) AS funciones_creadas,
    NOW() AS fecha_actualizacion;

-- CONSULTA PARA VERIFICAR LA ESTRUCTURA
SELECT 
    '=== VERIFICACIÓN DE ESTRUCTURA FINAL ===' AS titulo;

SELECT 
    c.nombre AS CATEGORIA,
    COALESCE(p.tipo, '(Sin tipo)') AS TIPO,
    p.nombre AS LINEA_MARCA,
    COUNT(DISTINCT vp.id_variante_producto) AS TOTAL_VARIANTES
FROM categorias c
JOIN productos p ON c.id_categoria = p.id_categoria
JOIN variantes_producto vp ON p.id_producto = vp.id_producto
WHERE p.activo = TRUE AND vp.activo = TRUE
GROUP BY c.nombre, p.tipo, p.nombre
ORDER BY c.nombre, p.tipo, p.nombre;