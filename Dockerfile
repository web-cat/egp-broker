# Stage 1: Build frontend
FROM node:22-alpine AS frontend-dev

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Stage 2: Build backend
FROM node:22 AS backend-dev

WORKDIR /app
COPY backend/package*.json ./
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

COPY backend/ ./
EXPOSE 3000
CMD ["nodemon", "index.js"]
