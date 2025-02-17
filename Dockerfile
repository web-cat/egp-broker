# Stage 1: Build the frontend
FROM node:14 AS frontend-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build the backend
FROM node:14 AS backend-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm install
COPY server/ ./

# Copy the built frontend into the server folder
COPY --from=frontend-builder /app/client/build /app/server/public

# Run the Next.js app
CMD ["npm", "run", "start"]