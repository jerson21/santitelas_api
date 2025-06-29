-- ==========================================================
-- VERIFICACIÓN DE INSTALACIÓN COMPLETA
-- Este archivo se ejecuta al final para confirmar que todo está OK
-- ==========================================================

-- Banner de éxito
SELECT 
    '🚀 ===========================================' AS '',
    '🚀 SANTITELAS DATABASE READY!' AS '',
    '🚀 ===========================================' AS '';

-- Verificar base de datos
SELECT 
    CONCAT('📊 Base de datos: ', DATABASE()) AS 'Información',
    CONCAT('🕐 Fecha instalación: ', NOW()) AS 'Timestamp';

-- Contar objetos creados
SELECT 
    '📈 RESUMEN DE OBJETOS CREADOS:' AS 'Categoría',
    '' AS 'Cantidad';

SELECT 
    CONCAT('   ✅ Tablas: ', COUNT(*)) AS 'Objeto',
    '' AS ''
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_TYPE = 'BASE TABLE';

SELECT 
    CONCAT('   ✅ Vistas: ', COUNT(*)) AS 'Objeto',
    '' AS ''
FROM information_schema.VIEWS 
WHERE TABLE_SCHEMA = DATABASE();

SELECT 
    CONCAT('   ✅ Procedures: ', COUNT(*)) AS 'Objeto',
    '' AS ''
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = DATABASE() 
AND ROUTINE_TYPE = 'PROCEDURE';

SELECT 
    CONCAT('   ✅ Functions: ', COUNT(*)) AS 'Objeto',
    '' AS ''
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = DATABASE() 
AND ROUTINE_TYPE = 'FUNCTION';

SELECT 
    CONCAT('   ✅ Triggers: ', COUNT(*)) AS 'Objeto',
    '' AS ''
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE();

-- Listar procedures creados
SELECT 
    '🔧 PROCEDURES DISPONIBLES:' AS 'Listado',
    '' AS '';

SELECT 
    CONCAT('   • ', ROUTINE_NAME) AS 'Procedure',
    CONCAT('Parámetros: ', 
        CASE 
            WHEN ROUTINE_NAME = 'crear_modalidades_para_variante' THEN 'p_id_variante_producto'
            WHEN ROUTINE_NAME = 'procesar_venta_stock_bodega' THEN 'p_id_venta, p_id_bodega, p_id_usuario'
            WHEN ROUTINE_NAME = 'abrir_turno_caja' THEN 'p_id_caja, p_id_cajero, p_monto_inicial, p_observaciones'
            WHEN ROUTINE_NAME = 'cerrar_turno_caja' THEN 'p_id_cajero, p_monto_real_cierre, p_observaciones'
            WHEN ROUTINE_NAME = 'ajustar_stock_bodega' THEN 'p_id_variante, p_id_bodega, p_nueva_cantidad, p_motivo, p_id_usuario'
            WHEN ROUTINE_NAME = 'transferir_stock_entre_bodegas' THEN 'p_id_variante, p_bodega_origen, p_bodega_destino, p_cantidad, p_motivo, p_id_usuario'
            ELSE 'Ver definición'
        END
    ) AS 'Descripción'
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = DATABASE() 
AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;

-- Verificar usuarios del sistema
SELECT 
    '👤 USUARIOS DEL SISTEMA:' AS 'Usuarios',
    '' AS '';

SELECT 
    CONCAT('   • ', u.usuario, ' (', r.nombre, ')') AS 'Usuario',
    u.nombre_completo AS 'Nombre Completo'
FROM usuarios u
JOIN roles r ON u.id_rol = r.id_rol
ORDER BY r.id_rol, u.usuario;

-- Verificar productos de ejemplo
SELECT 
    '📦 PRODUCTOS DE EJEMPLO:' AS 'Productos',
    COUNT(*) AS 'Total'
FROM productos;

SELECT 
    CONCAT('   • ', nombre, ' (', COALESCE(tipo, 'Sin tipo'), ')') AS 'Producto',
    CONCAT(COUNT(vp.id_variante_producto), ' variantes') AS 'Variantes'
FROM productos p
LEFT JOIN variantes_producto vp ON p.id_producto = vp.id_producto
GROUP BY p.id_producto
LIMIT 5;

-- Información de acceso
SELECT 
    '🌐 ACCESOS DISPONIBLES:' AS 'Servicio',
    '' AS '';

SELECT 
    '   📊 phpMyAdmin' AS 'Servicio',
    'http://localhost:8080' AS 'URL'
UNION ALL
SELECT 
    '   🚀 API Backend' AS 'Servicio',
    'http://localhost:5000' AS 'URL'
UNION ALL
SELECT 
    '   🏥 Health Check' AS 'Servicio',
    'http://localhost:5000/api/health' AS 'URL';

-- Credenciales de prueba
SELECT 
    '🔐 CREDENCIALES DE PRUEBA:' AS 'Usuario',
    '' AS 'Contraseña';

SELECT 
    CONCAT('   • ', usuario) AS 'Usuario',
    CASE 
        WHEN usuario = 'admin' THEN 'admin123'
        WHEN usuario = 'cajero1' THEN 'cajero123'
        WHEN usuario = 'vendedor1' THEN 'vendedor123'
        ELSE 'Ver documentación'
    END AS 'Contraseña'
FROM usuarios
WHERE activo = TRUE
ORDER BY id_rol;

-- Mensaje final
SELECT 
    '✅ ===========================================' AS '',
    '✅ ¡BASE DE DATOS LISTA PARA USAR!' AS '',
    '✅ ===========================================' AS '';