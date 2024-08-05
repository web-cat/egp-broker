FROM node:22-alpine

WORKDIR /app

# Install dependencies for both frontend and backend
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm install --prefix frontend
RUN npm install --prefix backend
RUN npm install -g nodemon

# Copy the source code for both frontend and backend
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Expose ports for frontend and backend
EXPOSE 5173
EXPOSE 3000

# Command to start both frontend and backend
CMD ["sh", "-c", "cd /app/frontend && npm run dev & cd /app/backend && nodemon index.js"]
