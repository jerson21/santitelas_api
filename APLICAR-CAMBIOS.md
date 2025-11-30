# 🔧 Cómo Aplicar los Nuevos Cambios AHORA

## 📋 ¿Qué acabamos de hacer?

Creamos una estructura para trabajar con **desarrollo** (hot reload) y **producción** (optimizado) por separado.

**Archivos nuevos creados:**
- ✅ `Dockerfile.dev` - Para desarrollo con hot reload
- ✅ `docker-compose.dev.yml` - Configuración de desarrollo
- ✅ `docker-compose.prod.yml` - Configuración de producción
- ✅ `DEPLOY.md` - Documentación completa
- ✅ `QUICK-START.md` - Guía rápida
- ✅ Este archivo que estás leyendo

**Archivos modificados:**
- ✅ `docker-compose.yml` - Ahora es la configuración BASE (común a ambos entornos)

---

## 🚀 Pasos para Aplicar los Cambios AHORA

### 1️⃣ Detener el contenedor actual

```bash
cd C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api

# Detener lo que esté corriendo
docker stop santitelas-api
docker rm santitelas-api
```

### 2️⃣ Iniciar en modo DESARROLLO (con hot reload)

```bash
# Iniciar con la nueva configuración
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

**⏳ Espera 1-2 minutos mientras se construye la imagen...**

### 3️⃣ Verificar que está funcionando

```bash
# Ver logs
docker logs -f santitelas-api

# Deberías ver algo como:
# "🚀 Servidor: http://localhost:5000"
# "[nodemon] starting `ts-node src/server.ts`"
```

### 4️⃣ Probar el hot reload

1. **Abre** cualquier archivo TypeScript, por ejemplo:
   ```
   C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api\src\routes\vendedor.routes.ts
   ```

2. **Agrega** un comentario o espacio en blanco

3. **Guarda** el archivo

4. **Observa** los logs del contenedor:
   ```bash
   docker logs -f santitelas-api
   ```

5. **Deberías ver**:
   ```
   [nodemon] restarting due to changes...
   [nodemon] starting `ts-node src/server.ts`
   🚀 Servidor iniciado...
   ```

**✨ ¡Listo! Ahora los cambios se aplican automáticamente**

---

## ✅ Verificación Final

```bash
# 1. Verificar que está en modo desarrollo
docker exec santitelas-api env | grep NODE_ENV
# Debe mostrar: NODE_ENV=development

# 2. Verificar que usa nodemon
docker exec santitelas-api ps aux | grep node
# Debe mostrar algo con "nodemon" o "ts-node"

# 3. Probar la API
curl http://localhost:5000/api/health
# Debe responder: {"status":"ok","timestamp":"..."}
```

---

## 🎯 ¿Y el problema del nombre del cliente?

El problema original era que los cambios en TypeScript no se aplicaban porque:
- ❌ Estabas en modo producción (código compilado en la imagen)
- ❌ Los cambios en `src/` no se reflejaban en `dist/`

**Ahora con modo desarrollo:**
- ✅ Los cambios en `src/` se aplican inmediatamente
- ✅ Nodemon reinicia el servidor automáticamente
- ✅ No necesitas recompilar manualmente

**Para verificar que el endpoint `/vendedor/mis-vales` ahora devuelve `nombre_cliente`:**

```bash
# 1. Iniciar sesión como vendedor y obtener token
# (usa Postman o el frontend)

# 2. Hacer request al endpoint
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:5000/api/vendedor/mis-vales

# 3. Deberías ver en la respuesta:
# {
#   "success": true,
#   "data": [
#     {
#       "numero_pedido": "VP20251015-0005",
#       "nombre_cliente": "Juan Pérez",  ← ¡AHORA ESTÁ!
#       ...
#     }
#   ]
# }
```

---

## 🔄 Comandos para el día a día (DESARROLLO)

```bash
# Ver logs en tiempo real
docker logs -f santitelas-api

# Detener contenedores
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Reiniciar contenedores
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Reconstruir (solo si cambias package.json o Dockerfile.dev)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

---

## 🏭 Para PRODUCCIÓN (cuando llegue el momento)

```bash
# Detener desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Iniciar producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## 🆘 Si algo sale mal

### El contenedor no inicia

```bash
# Ver qué pasó
docker logs santitelas-api

# Limpiar todo y empezar de cero
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Los cambios no se aplican automáticamente

```bash
# Verificar que el volumen está montado correctamente
docker inspect santitelas-api | grep -A 5 Mounts

# Deberías ver algo como:
# "Source": "C:\\Users\\jerso\\Documents\\Proyectos\\backend_santitelas\\santitelas-api\\src"
# "Destination": "/app/src"
```

### Puerto 5000 ocupado

```bash
# Ver qué está usando el puerto
netstat -ano | findstr :5000

# Matar el proceso (reemplaza PID con el número que aparece)
taskkill /PID 1234 /F
```

---

## 📚 Más Información

- **Guía rápida**: [QUICK-START.md](./QUICK-START.md)
- **Documentación completa**: [DEPLOY.md](./DEPLOY.md)

---

**✨ ¡Listo! Ahora tienes hot reload y no necesitas recompilar manualmente.**
