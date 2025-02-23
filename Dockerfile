# Stage 1: Build the frontend
FROM node:20.5 AS frontend-builder
WORKDIR /app/client
COPY frontend_epg/package.json ./
RUN npm install --force
COPY frontend_epg/ ./
RUN npm run build

# Stage 2: Build the backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY --from=frontend-builder /app/client/out /app/server/public
CMD ["npm", "run", "start"]