# Usa una imagen muy ligera de Node.js
FROM node:20-alpine AS base

# 1. Instalar dependencias
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Construir la aplicación (El Build)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Imagen de Producción (Súper ligera)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

# Copiamos solo lo necesario del paso anterior
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Inicia la aplicación
CMD ["node", "server.js"]