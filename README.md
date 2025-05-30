# 🏪 SANTITELAS API

Sistema POS completo para control de telas e inventario por metros.

## 🚀 Instalación Rápida

```bash
# Construir e iniciar con Docker
docker-compose up -d --build

# Verificar funcionamiento
curl http://localhost:5000/api/health
```

## 🔐 Credenciales

- Usuario: `admin`
- Password: `password`

## 📊 Servicios

- API: http://localhost:5000
- Adminer: http://localhost:8080  
- MySQL: localhost:3306

## 🧪 Endpoints Disponibles

```bash
# Health Check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Categorías
curl http://localhost:5000/api/vendedor/categorias

# Productos
curl http://localhost:5000/api/admin/productos
```

## 🛠️ Comandos Útiles

```bash
# Ver logs de la API
docker-compose logs -f santitelas-api

# Ver logs de MySQL
docker-compose logs -f mysql

# Reiniciar servicios
docker-compose restart

# Detener todo
docker-compose down

# Reconstruir desde cero
docker-compose down -v
docker-compose up -d --build
```

## 📦 Base de Datos Incluida

- ✅ **Roles y usuarios** con admin por defecto
- ✅ **Categorías**: Telas, Corchetes, Patas, Botones  
- ✅ **Productos de ejemplo** con colores separados
- ✅ **Stock por bodegas**: Sala Ventas, Bodega Principal, Bodega Telas
- ✅ **Métodos de pago**: Efectivo, Tarjetas, Transferencias
- ✅ **Tipos de documento**: Tickets, Boletas, Facturas

## 🏗️ Estructura del Proyecto

```
santitelas-api/
├── src/server.ts           # Servidor principal con endpoints
├── database/santitelas.sql # Base de datos completa
├── docker-compose.yml      # Configuración Docker  
├── Dockerfile             # Imagen de la API
└── package.json           # Dependencias Node.js
```
