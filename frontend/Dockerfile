# Stage 1: Base image with pnpm
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 2: Install dependencies
FROM base AS dependencies
WORKDIR /app
RUN npm install -g corepack@latest
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod
COPY . .

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app ./
RUN npm install -g corepack@latest
RUN pnpm build

# Stage 4: Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
COPY --from=dependencies /app/node_modules ./node_modules
EXPOSE 3000
RUN npm install -g corepack@latest
CMD ["pnpm", "start"]
