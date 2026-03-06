# Usar una imagen de Node.js ligera
FROM node:20-slim

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar TypeScript
RUN npm run build

# El bot no necesita exponer puertos, pero si usas Webhooks en el futuro, podrías necesitarlo
# EXPOSE 3000

# Comando para iniciar el bot
CMD ["npm", "start"]
