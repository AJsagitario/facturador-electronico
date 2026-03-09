# api-core/Dockerfile

# CAMBIO IMPORTANTE: Usamos Node 20 que ya trae 'crypto' global
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]