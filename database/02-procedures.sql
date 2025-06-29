-- ==========================================================
-- SANTITELAS - PROCEDURES ALMACENADOS
-- Versión corregida para Docker MySQL + MANEJO DE RESERVAS
-- ==========================================================

DELIMITER $$

-- ==========================================================
-- 1. PROCEDURE: crear_modalidades_para_variante
-- ==========================================================
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
END$$

-- ==========================================================
-- 2. PROCEDURE: procesar_venta_stock_bodega
-- ==========================================================
CREATE PROCEDURE procesar_venta_stock_bodega(
    IN p_id_venta INT,
    IN p_id_bodega INT,
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_pedido INT DEFAULT 0;
    DECLARE v_numero_venta VARCHAR(20) DEFAULT '';
    DECLARE v_terminado BOOLEAN DEFAULT FALSE;
    DECLARE v_id_variante_producto INT;
    DECLARE v_cantidad_vendida DECIMAL(10,2);
    DECLARE v_stock_disponible DECIMAL(10,2);
    DECLARE v_stock_anterior DECIMAL(10,2);
    DECLARE v_stock_nuevo DECIMAL(10,2);
    DECLARE v_producto_nombre VARCHAR(200);
    DECLARE v_variante_descripcion VARCHAR(200);
    DECLARE v_items_procesados INT DEFAULT 0;
    DECLARE v_total_items INT DEFAULT 0;
    DECLARE v_error_msg VARCHAR(500);
    
    -- Cursor para recorrer los items del pedido
    DECLARE cursor_items CURSOR FOR
        SELECT vp.id_variante_producto, dp.cantidad,
               CONCAT(p.nombre, ' - ', 
                     COALESCE(vp.color, ''), 
                     CASE WHEN vp.color IS NOT NULL AND vp.medida IS NOT NULL THEN ' ' ELSE '' END,
                     COALESCE(vp.medida, '')) as descripcion_completa
        FROM ventas v
        JOIN pedidos ped ON v.id_pedido = ped.id_pedido
        JOIN detalle_pedidos dp ON ped.id_pedido = dp.id_pedido
        JOIN variantes_producto vp ON dp.id_variante_producto = vp.id_variante_producto
        JOIN productos p ON vp.id_producto = p.id_producto
        WHERE v.id_venta = p_id_venta;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_terminado = TRUE;
    
    -- Variables para manejo de errores (CORREGIDO)
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    -- Validar que la venta existe
    SELECT v.id_pedido, v.numero_venta
    INTO v_id_pedido, v_numero_venta
    FROM ventas v
    WHERE v.id_venta = p_id_venta;
    
    IF v_id_pedido = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Venta no encontrada';
    END IF;
    
    -- Contar total de items para logging
    SELECT COUNT(*) INTO v_total_items
    FROM ventas v
    JOIN pedidos ped ON v.id_pedido = ped.id_pedido
    JOIN detalle_pedidos dp ON ped.id_pedido = dp.id_pedido
    WHERE v.id_venta = p_id_venta;
    
    -- Verificar que la bodega existe
    IF NOT EXISTS (SELECT 1 FROM bodegas WHERE id_bodega = p_id_bodega AND activa = TRUE) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Bodega no encontrada o inactiva';
    END IF;
    
    -- Abrir cursor y procesar cada item
    OPEN cursor_items;
    
    loop_items: LOOP
        FETCH cursor_items INTO v_id_variante_producto, v_cantidad_vendida, v_variante_descripcion;
        
        IF v_terminado THEN
            LEAVE loop_items;
        END IF;
        
        -- Verificar stock disponible
        SELECT COALESCE(cantidad_disponible, 0) 
        INTO v_stock_disponible
        FROM stock_por_bodega 
        WHERE id_variante_producto = v_id_variante_producto 
        AND id_bodega = p_id_bodega;
        
        -- Si no hay registro de stock, consideramos stock 0
        IF v_stock_disponible IS NULL THEN
            SET v_stock_disponible = 0;
        END IF;
        
        -- Validar stock suficiente
        IF v_stock_disponible < v_cantidad_vendida THEN
            SET v_error_msg = CONCAT(
                'Stock insuficiente para: ', v_variante_descripcion, 
                '. Disponible: ', v_stock_disponible, 
                ', Requerido: ', v_cantidad_vendida
            );
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
        END IF;
        
        -- Guardar stock anterior y calcular nuevo
        SET v_stock_anterior = v_stock_disponible;
        SET v_stock_nuevo = v_stock_disponible - v_cantidad_vendida;
        
        -- Actualizar stock en bodega
        UPDATE stock_por_bodega 
        SET cantidad_disponible = v_stock_nuevo,
            fecha_actualizacion = NOW()
        WHERE id_variante_producto = v_id_variante_producto 
        AND id_bodega = p_id_bodega;
        
        -- Si no existía el registro, crearlo (aunque debería existir)
        IF ROW_COUNT() = 0 THEN
            INSERT INTO stock_por_bodega (
                id_variante_producto, 
                id_bodega, 
                cantidad_disponible,
                cantidad_reservada,
                fecha_actualizacion
            ) VALUES (
                v_id_variante_producto, 
                p_id_bodega, 
                -v_cantidad_vendida,
                0,
                NOW()
            );
        END IF;
        
        -- Registrar movimiento de stock
        INSERT INTO movimientos_stock (
            id_variante_producto,
            id_bodega,
            tipo_movimiento,
            cantidad,
            stock_anterior,
            stock_nuevo,
            motivo,
            referencia,
            id_usuario,
            fecha_movimiento
        ) VALUES (
            v_id_variante_producto,
            p_id_bodega,
            'salida',
            v_cantidad_vendida,
            v_stock_anterior,
            v_stock_nuevo,
            'Venta procesada',
            v_numero_venta,
            p_id_usuario,
            NOW()
        );
        
        SET v_items_procesados = v_items_procesados + 1;
        
    END LOOP loop_items;
    
    CLOSE cursor_items;
    
    -- Log final del proceso (opcional - para debug)
    INSERT INTO movimientos_stock (
        id_variante_producto,
        id_bodega,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo,
        referencia,
        id_usuario,
        fecha_movimiento
    ) VALUES (
        1,
        p_id_bodega,
        'salida',
        0,
        0,
        0,
        CONCAT('VENTA COMPLETADA - ', v_items_procesados, '/', v_total_items, ' items procesados'),
        v_numero_venta,
        p_id_usuario,
        NOW()
    );

END$$

-- ==========================================================
-- 3. PROCEDURE: abrir_turno_caja
-- ==========================================================
CREATE PROCEDURE abrir_turno_caja(
    IN p_id_caja INT,
    IN p_id_cajero INT,
    IN p_monto_inicial DECIMAL(10,2),
    IN p_observaciones_apertura TEXT,
    OUT p_id_turno INT,
    OUT p_mensaje VARCHAR(500)
)
BEGIN
    DECLARE v_turno_abierto INT DEFAULT 0;
    DECLARE v_caja_activa INT DEFAULT 0;
    
    -- Validar que no tenga un turno abierto
    SELECT COUNT(*) INTO v_turno_abierto
    FROM turnos_caja 
    WHERE id_cajero = p_id_cajero 
    AND estado = 'abierto';
    
    IF v_turno_abierto > 0 THEN
        SET p_mensaje = 'El cajero ya tiene un turno abierto';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cajero ya tiene un turno abierto';
    END IF;
    
    -- Validar que la caja existe y está activa
    SELECT COUNT(*) INTO v_caja_activa
    FROM cajas 
    WHERE id_caja = p_id_caja 
    AND activa = TRUE;
    
    IF v_caja_activa = 0 THEN
        SET p_mensaje = 'Caja no encontrada o inactiva';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Caja no encontrada o inactiva';
    END IF;
    
    -- Crear el turno
    INSERT INTO turnos_caja (
        id_caja,
        id_cajero,
        fecha_apertura,
        monto_inicial,
        estado,
        observaciones_apertura
    ) VALUES (
        p_id_caja,
        p_id_cajero,
        NOW(),
        p_monto_inicial,
        'abierto',
        p_observaciones_apertura
    );
    
    SET p_id_turno = LAST_INSERT_ID();
    SET p_mensaje = CONCAT('Turno abierto exitosamente con ID: ', p_id_turno);
    
END$$

-- ==========================================================
-- 4. PROCEDURE: cerrar_turno_caja
-- ==========================================================
CREATE PROCEDURE cerrar_turno_caja(
    IN p_id_cajero INT,
    IN p_monto_real_cierre DECIMAL(10,2),
    IN p_observaciones_cierre TEXT,
    OUT p_dinero_teorico DECIMAL(10,2),
    OUT p_diferencia DECIMAL(10,2),
    OUT p_mensaje VARCHAR(500)
)
BEGIN
    DECLARE v_id_turno INT DEFAULT 0;
    DECLARE v_total_ventas DECIMAL(10,2) DEFAULT 0;
    DECLARE v_cantidad_ventas INT DEFAULT 0;
    
    -- Buscar turno abierto del cajero
    SELECT id_turno INTO v_id_turno
    FROM turnos_caja 
    WHERE id_cajero = p_id_cajero 
    AND estado = 'abierto'
    LIMIT 1;
    
    IF v_id_turno = 0 THEN
        SET p_mensaje = 'No hay turno abierto para este cajero';
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No hay turno abierto para este cajero';
    END IF;
    
    -- Calcular dinero teórico
    SET p_dinero_teorico = calcular_dinero_teorico_turno(v_id_turno);
    SET p_diferencia = p_monto_real_cierre - p_dinero_teorico;
    
    -- Calcular estadísticas del turno
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_total_ventas, v_cantidad_ventas
    FROM ventas 
    WHERE id_turno = v_id_turno 
    AND estado = 'completada';
    
    -- Actualizar el turno
    UPDATE turnos_caja 
    SET fecha_cierre = NOW(),
        monto_real_cierre = p_monto_real_cierre,
        monto_teorico_cierre = p_dinero_teorico,
        diferencia = p_diferencia,
        total_ventas = v_total_ventas,
        cantidad_ventas = v_cantidad_ventas,
        estado = 'cerrado',
        observaciones_cierre = p_observaciones_cierre
    WHERE id_turno = v_id_turno;
    
    SET p_mensaje = CONCAT(
        'Turno cerrado. Diferencia: ', 
        IF(p_diferencia = 0, 'Sin diferencias', 
           CONCAT('$', ABS(p_diferencia), ' ', IF(p_diferencia > 0, 'sobrante', 'faltante')))
    );
    
END$$

-- ==========================================================
-- 5. PROCEDURE: ajustar_stock_bodega
-- ==========================================================
CREATE PROCEDURE ajustar_stock_bodega(
    IN p_id_variante_producto INT,
    IN p_id_bodega INT,
    IN p_nueva_cantidad DECIMAL(10,2),
    IN p_motivo VARCHAR(100),
    IN p_id_usuario INT,
    OUT p_mensaje VARCHAR(500)
)
BEGIN
    DECLARE v_stock_anterior DECIMAL(10,2) DEFAULT 0;
    DECLARE v_diferencia DECIMAL(10,2);
    DECLARE v_tipo_movimiento VARCHAR(20);
    
    -- Obtener stock actual
    SELECT COALESCE(cantidad_disponible, 0) 
    INTO v_stock_anterior
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante_producto 
    AND id_bodega = p_id_bodega;
    
    -- Calcular diferencia
    SET v_diferencia = p_nueva_cantidad - v_stock_anterior;
    SET v_tipo_movimiento = IF(v_diferencia > 0, 'entrada', 'salida');
    
    -- Actualizar o insertar stock
    INSERT INTO stock_por_bodega (
        id_variante_producto, 
        id_bodega, 
        cantidad_disponible,
        fecha_actualizacion
    ) VALUES (
        p_id_variante_producto, 
        p_id_bodega, 
        p_nueva_cantidad,
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        cantidad_disponible = p_nueva_cantidad,
        fecha_actualizacion = NOW();
    
    -- Registrar movimiento
    INSERT INTO movimientos_stock (
        id_variante_producto,
        id_bodega,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo,
        referencia,
        id_usuario,
        fecha_movimiento
    ) VALUES (
        p_id_variante_producto,
        p_id_bodega,
        'ajuste',
        ABS(v_diferencia),
        v_stock_anterior,
        p_nueva_cantidad,
        p_motivo,
        CONCAT('AJUSTE-', DATE_FORMAT(NOW(), '%Y%m%d-%H%i%s')),
        p_id_usuario,
        NOW()
    );
    
    SET p_mensaje = CONCAT(
        'Stock ajustado de ', v_stock_anterior, ' a ', p_nueva_cantidad,
        ' (', IF(v_diferencia > 0, '+', ''), v_diferencia, ')'
    );
    
END$$

-- ==========================================================
-- 6. PROCEDURE: transferir_stock_entre_bodegas
-- ==========================================================
CREATE PROCEDURE transferir_stock_entre_bodegas(
    IN p_id_variante_producto INT,
    IN p_id_bodega_origen INT,
    IN p_id_bodega_destino INT,
    IN p_cantidad DECIMAL(10,2),
    IN p_motivo VARCHAR(100),
    IN p_id_usuario INT,
    OUT p_mensaje VARCHAR(500)
)
BEGIN
    DECLARE v_stock_origen DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_destino DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_origen_nuevo DECIMAL(10,2);
    DECLARE v_stock_destino_nuevo DECIMAL(10,2);
    DECLARE v_referencia VARCHAR(50);
    DECLARE v_error_msg VARCHAR(500);
    
    -- Validar cantidad positiva
    IF p_cantidad <= 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'La cantidad a transferir debe ser mayor a 0';
    END IF;
    
    -- Generar referencia única
    SET v_referencia = CONCAT('TRANS-', DATE_FORMAT(NOW(), '%Y%m%d-%H%i%s'));
    
    -- Obtener stock origen
    SELECT COALESCE(cantidad_disponible, 0)
    INTO v_stock_origen
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante_producto 
    AND id_bodega = p_id_bodega_origen;
    
    -- Validar stock suficiente en origen
    IF v_stock_origen < p_cantidad THEN
        SET v_error_msg = CONCAT(
            'Stock insuficiente en bodega origen. Disponible: ', v_stock_origen,
            ', Requerido: ', p_cantidad
        );
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
    END IF;
    
    -- Obtener stock destino
    SELECT COALESCE(cantidad_disponible, 0)
    INTO v_stock_destino
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante_producto 
    AND id_bodega = p_id_bodega_destino;
    
    -- Calcular nuevos stocks
    SET v_stock_origen_nuevo = v_stock_origen - p_cantidad;
    SET v_stock_destino_nuevo = v_stock_destino + p_cantidad;
    
    -- Actualizar stock origen
    UPDATE stock_por_bodega 
    SET cantidad_disponible = v_stock_origen_nuevo,
        fecha_actualizacion = NOW()
    WHERE id_variante_producto = p_id_variante_producto 
    AND id_bodega = p_id_bodega_origen;
    
    -- Actualizar o insertar stock destino
    INSERT INTO stock_por_bodega (
        id_variante_producto, 
        id_bodega, 
        cantidad_disponible,
        fecha_actualizacion
    ) VALUES (
        p_id_variante_producto, 
        p_id_bodega_destino, 
        v_stock_destino_nuevo,
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        cantidad_disponible = v_stock_destino_nuevo,
        fecha_actualizacion = NOW();
    
    -- Registrar movimiento de salida en origen
    INSERT INTO movimientos_stock (
        id_variante_producto,
        id_bodega,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        id_bodega_destino,
        motivo,
        referencia,
        id_usuario,
        fecha_movimiento
    ) VALUES (
        p_id_variante_producto,
        p_id_bodega_origen,
        'transferencia',
        p_cantidad,
        v_stock_origen,
        v_stock_origen_nuevo,
        p_id_bodega_destino,
        p_motivo,
        v_referencia,
        p_id_usuario,
        NOW()
    );
    
    -- Registrar movimiento de entrada en destino
    INSERT INTO movimientos_stock (
        id_variante_producto,
        id_bodega,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        id_bodega_destino,
        motivo,
        referencia,
        id_usuario,
        fecha_movimiento
    ) VALUES (
        p_id_variante_producto,
        p_id_bodega_destino,
        'transferencia',
        p_cantidad,
        v_stock_destino,
        v_stock_destino_nuevo,
        p_id_bodega_origen,
        p_motivo,
        v_referencia,
        p_id_usuario,
        NOW()
    );
    
    SET p_mensaje = CONCAT(
        'Transferencia completada: ', p_cantidad, ' unidades de bodega ', 
        p_id_bodega_origen, ' a bodega ', p_id_bodega_destino
    );
    
END$$

-- ==========================================================
-- 7. PROCEDURE: crear_reserva_stock (NUEVO)
-- Crea una reserva temporal de stock para un vale
-- ==========================================================
CREATE PROCEDURE crear_reserva_stock(
    IN p_id_pedido INT,
    IN p_id_variante INT,
    IN p_id_bodega INT,
    IN p_cantidad DECIMAL(10,2)
)
BEGIN
    DECLARE v_stock_disponible DECIMAL(10,2) DEFAULT 0;
    DECLARE v_producto_desc VARCHAR(200);
    DECLARE v_error_msg VARCHAR(500);
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Obtener descripción del producto para mensajes de error
    SELECT CONCAT(p.nombre, ' - ', COALESCE(vp.color, ''), ' ', COALESCE(vp.medida, ''))
    INTO v_producto_desc
    FROM variantes_producto vp
    JOIN productos p ON vp.id_producto = p.id_producto
    WHERE vp.id_variante_producto = p_id_variante;
    
    -- Obtener stock disponible actual con bloqueo
    SELECT cantidad_disponible 
    INTO v_stock_disponible
    FROM stock_por_bodega 
    WHERE id_variante_producto = p_id_variante
      AND id_bodega = p_id_bodega
    FOR UPDATE;
    
    -- Validar stock suficiente
    IF v_stock_disponible < p_cantidad THEN
        SET v_error_msg = CONCAT(
            'Stock insuficiente para reservar: ', v_producto_desc,
            '. Disponible: ', v_stock_disponible, 
            ', Requerido: ', p_cantidad
        );
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
    END IF;
    
    -- Actualizar stock: mover de disponible a reservado
    UPDATE stock_por_bodega 
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        cantidad_reservada = cantidad_reservada + p_cantidad,
        fecha_actualizacion = NOW()
    WHERE id_variante_producto = p_id_variante
      AND id_bodega = p_id_bodega
      AND cantidad_disponible >= p_cantidad;
    
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'No se pudo actualizar el stock para crear la reserva';
    END IF;
    
    -- Registrar movimiento de reserva
    INSERT INTO movimientos_stock (
        id_variante_producto,
        id_bodega,
        tipo_movimiento,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo,
        referencia,
        id_usuario,
        fecha_movimiento
    ) VALUES (
        p_id_variante,
        p_id_bodega,
        'ajuste',
        p_cantidad,
        v_stock_disponible,
        v_stock_disponible - p_cantidad,
        CONCAT('Reserva temporal para vale #', p_id_pedido),
        CONCAT('VALE-', p_id_pedido),
        1, -- Sistema
        NOW()
    );
    
    COMMIT;
END$$

-- ==========================================================
-- 8. PROCEDURE: liberar_reservas_pedido (NUEVO)
-- Libera todas las reservas de un pedido específico
-- ==========================================================
CREATE PROCEDURE liberar_reservas_pedido(IN p_id_pedido INT)
BEGIN
    DECLARE v_id_variante INT;
    DECLARE v_id_bodega INT;
    DECLARE v_cantidad DECIMAL(10,2);
    DECLARE v_terminado INT DEFAULT FALSE;
    DECLARE v_items_liberados INT DEFAULT 0;
    
    -- Cursor para recorrer los detalles del pedido con bodega asignada
    DECLARE cur CURSOR FOR
        SELECT dp.id_variante_producto, 
               COALESCE(dp.id_bodega, JSON_UNQUOTE(JSON_EXTRACT(dp.metadatos, '$.bodega_asignada'))),
               dp.cantidad
        FROM detalle_pedidos dp
        WHERE dp.id_pedido = p_id_pedido
          AND (dp.id_bodega IS NOT NULL 
               OR JSON_EXTRACT(dp.metadatos, '$.bodega_asignada') IS NOT NULL);
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_terminado = TRUE;
    
    -- Abrir cursor
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_id_variante, v_id_bodega, v_cantidad;
        
        IF v_terminado THEN
            LEAVE read_loop;
        END IF;
        
        -- Solo procesar si hay bodega válida
        IF v_id_bodega IS NOT NULL THEN
            -- Devolver stock reservado a disponible
            UPDATE stock_por_bodega 
            SET cantidad_disponible = cantidad_disponible + v_cantidad,
                cantidad_reservada = GREATEST(0, cantidad_reservada - v_cantidad),
                fecha_actualizacion = NOW()
            WHERE id_variante_producto = v_id_variante
              AND id_bodega = v_id_bodega
              AND cantidad_reservada >= v_cantidad;
            
            IF ROW_COUNT() > 0 THEN
                SET v_items_liberados = v_items_liberados + 1;
                
                -- Registrar movimiento de liberación
                INSERT INTO movimientos_stock (
                    id_variante_producto,
                    id_bodega,
                    tipo_movimiento,
                    cantidad,
                    stock_anterior,
                    stock_nuevo,
                    motivo,
                    referencia,
                    id_usuario,
                    fecha_movimiento
                ) VALUES (
                    v_id_variante,
                    v_id_bodega,
                    'ajuste',
                    v_cantidad,
                    0, -- No tenemos el valor anterior aquí
                    0, -- No tenemos el valor nuevo aquí
                    'Liberación de reserva por expiración',
                    CONCAT('VALE-', p_id_pedido, '-LIBERADO'),
                    1, -- Sistema
                    NOW()
                );
            END IF;
        END IF;
    END LOOP;
    
    CLOSE cur;
    
    -- Actualizar estado del pedido a cancelado/expirado
    UPDATE pedidos 
    SET estado = 'cancelado',
        observaciones = CONCAT(COALESCE(observaciones, ''), 
                             '\n[RESERVA LIBERADA AUTOMÁTICAMENTE - ', NOW(), 
                             ' - Items liberados: ', v_items_liberados, ']'),
        fecha_actualizacion = NOW()
    WHERE id_pedido = p_id_pedido
      AND estado = 'vale_pendiente';
END$$

-- ==========================================================
-- 9. PROCEDURE: limpiar_reservas_expiradas (NUEVO)
-- Limpia todas las reservas de pedidos expirados
-- ==========================================================
CREATE PROCEDURE limpiar_reservas_expiradas()
BEGIN
    DECLARE v_id_pedido INT;
    DECLARE v_terminado INT DEFAULT FALSE;
    DECLARE v_pedidos_procesados INT DEFAULT 0;
    DECLARE v_fecha_actual TIMESTAMP DEFAULT NOW();
    
    -- Cursor para pedidos expirados
    DECLARE cur CURSOR FOR
        SELECT id_pedido
        FROM pedidos
        WHERE estado = 'vale_pendiente'
          AND fecha_limite_reserva IS NOT NULL
          AND fecha_limite_reserva < v_fecha_actual;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_terminado = TRUE;
    
    -- Log de inicio
    INSERT INTO movimientos_stock (
        id_variante_producto, id_bodega, tipo_movimiento,
        cantidad, stock_anterior, stock_nuevo,
        motivo, referencia, id_usuario
    ) VALUES (
        1, 1, 'ajuste', 0, 0, 0,
        CONCAT('INICIO limpieza de reservas expiradas - ', v_fecha_actual),
        'SISTEMA-LIMPIEZA', 1
    );
    
    -- Abrir cursor
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_id_pedido;
        
        IF v_terminado THEN
            LEAVE read_loop;
        END IF;
        
        -- Liberar reservas del pedido
        CALL liberar_reservas_pedido(v_id_pedido);
        
        SET v_pedidos_procesados = v_pedidos_procesados + 1;
    END LOOP;
    
    CLOSE cur;
    
    -- Log de fin
    INSERT INTO movimientos_stock (
        id_variante_producto, id_bodega, tipo_movimiento,
        cantidad, stock_anterior, stock_nuevo,
        motivo, referencia, id_usuario
    ) VALUES (
        1, 1, 'ajuste', 0, 0, 0,
        CONCAT('FIN limpieza de reservas - Pedidos procesados: ', v_pedidos_procesados),
        'SISTEMA-LIMPIEZA', 1
    );
END$$

-- ==========================================================
-- 10. PROCEDURE: procesar_venta_con_reservas (NUEVO)
-- Procesa una venta convirtiendo las reservas en salidas definitivas
-- ==========================================================
CREATE PROCEDURE procesar_venta_con_reservas(
    IN p_id_pedido INT,
    IN p_id_usuario INT
)
BEGIN
    DECLARE v_id_variante INT;
    DECLARE v_id_bodega INT;
    DECLARE v_cantidad DECIMAL(10,2);
    DECLARE v_terminado INT DEFAULT FALSE;
    DECLARE v_items_procesados INT DEFAULT 0;
    DECLARE v_error_msg VARCHAR(500);
    
    -- Cursor para detalles con bodega asignada
    DECLARE cur CURSOR FOR
        SELECT dp.id_variante_producto, 
               COALESCE(dp.id_bodega, JSON_UNQUOTE(JSON_EXTRACT(dp.metadatos, '$.bodega_asignada'))),
               dp.cantidad
        FROM detalle_pedidos dp
        WHERE dp.id_pedido = p_id_pedido
          AND (dp.id_bodega IS NOT NULL 
               OR JSON_EXTRACT(dp.metadatos, '$.bodega_asignada') IS NOT NULL);
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_terminado = TRUE;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Abrir cursor
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_id_variante, v_id_bodega, v_cantidad;
        
        IF v_terminado THEN
            LEAVE read_loop;
        END IF;
        
        IF v_id_bodega IS NOT NULL THEN
            -- Convertir reserva en salida definitiva
            UPDATE stock_por_bodega 
            SET cantidad_reservada = GREATEST(0, cantidad_reservada - v_cantidad),
                fecha_actualizacion = NOW()
            WHERE id_variante_producto = v_id_variante
              AND id_bodega = v_id_bodega;
            
            IF ROW_COUNT() = 0 THEN
                SET v_error_msg = CONCAT(
                    'No se pudo procesar la reserva para variante ', v_id_variante,
                    ' en bodega ', v_id_bodega
                );
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_error_msg;
            END IF;
            
            SET v_items_procesados = v_items_procesados + 1;
        END IF;
    END LOOP;
    
    CLOSE cur;
    
    -- Actualizar estado del pedido
    UPDATE pedidos 
    SET estado = 'completado',
        fecha_actualizacion = NOW()
    WHERE id_pedido = p_id_pedido;
    
    COMMIT;
END$$

DELIMITER ;

-- ==========================================================
-- CREAR EVENT SCHEDULER PARA LIMPIEZA AUTOMÁTICA
-- ==========================================================

-- Habilitar el Event Scheduler
SET GLOBAL event_scheduler = ON;

-- Crear evento que se ejecuta cada 5 minutos
CREATE EVENT IF NOT EXISTS limpiar_reservas_event
ON SCHEDULE EVERY 5 MINUTE
DO CALL limpiar_reservas_expiradas();

-- ==========================================================
-- VERIFICACIÓN DE PROCEDURES CREADOS
-- ==========================================================

SELECT 
    '✅ PROCEDURES CREADOS EXITOSAMENTE' AS resultado,
    COUNT(*) AS total_procedures,
    GROUP_CONCAT(ROUTINE_NAME SEPARATOR ', ') AS procedures_list
FROM information_schema.ROUTINES 
WHERE ROUTINE_SCHEMA = DATABASE() 
AND ROUTINE_TYPE = 'PROCEDURE';

-- Verificar Event Scheduler
SELECT 
    '📅 EVENT SCHEDULER STATUS' AS titulo,
    @@event_scheduler AS estado,
    COUNT(*) AS eventos_activos
FROM information_schema.EVENTS
WHERE EVENT_SCHEMA = DATABASE();