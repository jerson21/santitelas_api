# 🚀 Guía de Deployment - Santitelas API

Esta guía explica cómo trabajar con el proyecto en **desarrollo** y **producción** usando Docker.

---

## 📋 Tabla de Contenidos

1. [Estructura de Archivos](#estructura-de-archivos)
2. [Diferencias entre Desarrollo y Producción](#diferencias-entre-desarrollo-y-producción)
3. [Comandos para Desarrollo](#comandos-para-desarrollo)
4. [Comandos para Producción](#comandos-para-producción)
5. [Solución de Problemas](#solución-de-problemas)
6. [Aplicar Cambios sin Recompilar](#aplicar-cambios-sin-recompilar)

---

## 📁 Estructura de Archivos

```
backend_santitelas/santitelas-api/
├── Dockerfile              # Para PRODUCCIÓN (código compilado)
├── Dockerfile.dev          # Para DESARROLLO (hot reload)
├── docker-compose.yml      # Configuración BASE (común)
├── docker-compose.dev.yml  # Override para DESARROLLO
├── docker-compose.prod.yml # Override para PRODUCCIÓN
├── package.json
├── tsconfig.json
├── src/                    # Código fuente TypeScript
│   ├── routes/
│   ├── models/
│   ├── controllers/
│   └── server.ts
└── dist/                   # Código compilado (generado automáticamente)
```

---

## 🔄 Diferencias entre Desarrollo y Producción

| Aspecto | Desarrollo | Producción |
|---------|-----------|------------|
| **Dockerfile** | `Dockerfile.dev` | `Dockerfile` |
| **Compilación** | ❌ No compila (usa ts-node) | ✅ Compila durante build |
| **Dependencias dev** | ✅ Instaladas (TypeScript, nodemon) | ❌ Eliminadas (optimización) |
| **Hot Reload** | ✅ Sí (nodemon detecta cambios) | ❌ No |
| **Volúmenes código** | ✅ Montados (`./src:/app/src`) | ❌ En la imagen |
| **Comando** | `npm run dev` | `npm start` |
| **NODE_ENV** | `development` | `production` |
| **Seeding DB** | ✅ Activado | ❌ Desactivado |

---

## 💻 Comandos para Desarrollo

### 🟢 Iniciar en modo desarrollo (HOT RELOAD)

```bash
cd C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api

# Iniciar todo (MySQL + API + PHPMyAdmin)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

**✨ ¿Qué hace esto?**
- ✅ Usa `Dockerfile.dev` (no compila TypeScript)
- ✅ Monta tu carpeta `src/` como volumen
- ✅ Nodemon detecta cambios automáticamente
- ✅ **NO necesitas reconstruir** cuando editas archivos `.ts`

### 🔄 Ver logs en tiempo real

```bash
# Ver logs de la API
docker-compose logs -f api

# Ver logs de MySQL
docker-compose logs -f mysql
```

### 🛑 Detener contenedores

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### 🔨 Reconstruir imagen (solo si cambias package.json o Dockerfile.dev)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### 🧹 Limpiar todo y empezar de cero

```bash
# Detener y eliminar volúmenes (¡borra la base de datos!)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans

# Reconstruir todo desde cero
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

---

## 🏭 Comandos para Producción

### 🟢 Iniciar en modo producción

```bash
cd C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api

# Iniciar todo (SIEMPRE usa --build en producción)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**✨ ¿Qué hace esto?**
- ✅ Usa `Dockerfile` (compila TypeScript durante el build)
- ✅ Código compilado y optimizado dentro de la imagen
- ✅ Elimina dependencias de desarrollo
- ✅ No monta carpeta `src/` como volumen
- ✅ Reinicia automáticamente si hay errores

### 🔄 Ver logs

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

### 🛑 Detener contenedores

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

### 🔄 Actualizar código en producción

```bash
# 1. Detener contenedores
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 2. Reconstruir imagen con nuevos cambios
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 🚨 Solución de Problemas

### ❌ Problema: "Los cambios en el código no se aplican"

**Causa**: Estás en modo producción o el volumen no está montado correctamente.

**Solución**:
```bash
# Verifica que estás usando docker-compose.dev.yml
docker ps

# Si ves que usa Dockerfile (producción), cambia a desarrollo:
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### ❌ Problema: "Error: Cannot find module 'typescript'"

**Causa**: Estás en modo producción (las dependencias dev fueron eliminadas).

**Solución**: Cambia a modo desarrollo.

### ❌ Problema: "El contenedor no inicia"

**Solución**:
```bash
# Ver logs para identificar el error
docker logs santitelas-api

# Si es error de permisos en Windows:
# Asegúrate de que Docker Desktop tenga acceso a la carpeta del proyecto
```

### ❌ Problema: "Puerto 5000 ya está en uso"

**Solución**:
```bash
# Ver qué está usando el puerto
netstat -ano | findstr :5000

# Detener contenedores anteriores
docker stop santitelas-api
docker rm santitelas-api
```

---

## ⚡ Aplicar Cambios sin Recompilar

### En DESARROLLO (automático con nodemon)

**✅ Cambios que se aplican AUTOMÁTICAMENTE:**
- Editas cualquier archivo `.ts` en `src/`
- Nodemon detecta el cambio
- Recompila automáticamente
- Reinicia el servidor
- **NO necesitas hacer nada**

**Ejemplo:**
```bash
# 1. Iniciar en desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Editar archivo
# Abre: src/routes/vendedor.routes.ts
# Modifica algo y guarda

# 3. Ver que se reinició automáticamente
docker logs -f santitelas-api
# Verás: "[nodemon] restarting due to changes..."
# Verás: "[nodemon] starting `ts-node src/server.ts`"
```

**❌ Cambios que requieren reconstruir:**
- Modificas `package.json` (agregar/quitar dependencias)
- Modificas `Dockerfile.dev`
- Modificas `docker-compose.dev.yml`

**Solución:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### En PRODUCCIÓN (requiere rebuild siempre)

En producción, **SIEMPRE** debes reconstruir la imagen:

```bash
# 1. Haces cambios en src/
# 2. Rebuild completo
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 🔍 Verificar en qué modo estás

```bash
# Ver variables de entorno del contenedor
docker exec santitelas-api env | grep NODE_ENV

# Si dice "development" → Modo desarrollo ✅
# Si dice "production" → Modo producción 🏭

# Ver qué comando está corriendo
docker exec santitelas-api ps aux | grep node

# Si dice "npm run dev" o "nodemon" → Desarrollo ✅
# Si dice "npm start" o "node dist/server.js" → Producción 🏭
```

---

## 📦 Comandos Útiles de Docker

```bash
# Ver contenedores corriendo
docker ps

# Ver todos los contenedores (incluyendo detenidos)
docker ps -a

# Ver logs de un contenedor
docker logs santitelas-api
docker logs -f santitelas-api  # Seguir logs en tiempo real

# Ejecutar comando dentro del contenedor
docker exec santitelas-api ls -la /app/src

# Entrar al shell del contenedor
docker exec -it santitelas-api sh

# Ver uso de recursos
docker stats santitelas-api

# Limpiar imágenes y contenedores sin usar
docker system prune -a
```

---

## 🗄️ Comandos de Base de Datos

```bash
# Conectar a MySQL
docker exec -it santitelas-mysql mysql -uroot -psantitelas_root_2024 santitelas

# Hacer backup
docker exec santitelas-mysql mysqldump -uroot -psantitelas_root_2024 \
  --single-transaction --routines --triggers santitelas > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker exec -i santitelas-mysql mysql -uroot -psantitelas_root_2024 santitelas < backup.sql

# Ver queries lentas
docker exec santitelas-mysql tail -f /var/log/mysql/slow.log
```

---

## 🎯 Flujo de Trabajo Recomendado

### Para desarrollo diario:

```bash
# 1. Iniciar en modo desarrollo (una vez al día)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Trabajar normalmente
# - Editas archivos en src/
# - Los cambios se aplican automáticamente
# - No necesitas reiniciar nada

# 3. Ver logs si hay errores
docker logs -f santitelas-api

# 4. Al terminar el día (opcional - se puede dejar corriendo)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### Para deploy a producción:

```bash
# 1. Asegurarte que los cambios funcionen en desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 2. Probar la aplicación localmente
# http://localhost:5000/api/health

# 3. Deploy a producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Verificar que está corriendo
docker logs santitelas-api
curl http://localhost:5000/api/health
```

---

## 📞 Contacto y Soporte

Si tienes problemas:
1. Revisa los logs: `docker logs santitelas-api`
2. Verifica que estás en el modo correcto (desarrollo/producción)
3. Consulta la sección de "Solución de Problemas"

---

**✨ ¡Listo! Ahora puedes trabajar con hot reload en desarrollo y hacer deploys optimizados en producción.**
