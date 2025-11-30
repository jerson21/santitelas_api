# ⚡ Quick Start - Santitelas API

## 🚀 Inicio Rápido

### DESARROLLO (con hot reload automático)

```bash
# Navegar a la carpeta del backend
cd C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api

# Iniciar todo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Ver logs
docker logs -f santitelas-api
```

**✨ Los cambios en archivos `.ts` se aplican automáticamente - NO necesitas reiniciar**

---

### PRODUCCIÓN (compilado y optimizado)

```bash
# Navegar a la carpeta del backend
cd C:\Users\jerso\Documents\Proyectos\backend_santitelas\santitelas-api

# Iniciar (siempre con --build)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Ver logs
docker logs -f santitelas-api
```

---

## 📝 Comandos más usados

```bash
# Ver logs en tiempo real
docker logs -f santitelas-api

# Detener desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Detener producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Reconstruir desarrollo (si cambias package.json)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Verificar en qué modo estás
docker exec santitelas-api env | grep NODE_ENV
```

---

## 🔍 URLs

- **API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health
- **PHPMyAdmin**: http://localhost:8080
- **MySQL**: localhost:3307

---

## 📚 Documentación completa

Lee [DEPLOY.md](./DEPLOY.md) para:
- Explicación detallada de cada comando
- Solución de problemas
- Flujo de trabajo recomendado
- Comandos de base de datos
- Diferencias entre desarrollo y producción

---

## ⚠️ Importante

| Cuando... | Usa este comando |
|-----------|------------------|
| Trabajas día a día | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| Editas archivos .ts | ✅ **Nada** - se aplica automáticamente |
| Cambias package.json | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` |
| Deploy a producción | `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |

---

**¿Problemas?** → Lee [DEPLOY.md](./DEPLOY.md) sección "Solución de Problemas"
