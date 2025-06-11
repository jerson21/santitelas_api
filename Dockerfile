FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache python3 make g++ libusb-dev eudev-dev linux-headers curl

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (incluyendo TypeScript)
RUN npm install

# Copiar código fuente
COPY src/ ./src/
COPY database/ ./database/

# Compilar TypeScript
RUN npm run build

# Limpiar dependencias de desarrollo después de compilar
RUN npm prune --production

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S santitelas -u 1001 -G nodejs

RUN mkdir -p /app/logs && \
    chown -R santitelas:nodejs /app

USER santitelas

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["npm", "start"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1
