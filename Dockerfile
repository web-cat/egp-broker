# Common base for both development and production
FROM node:22-bookworm-slim AS base

# Set environment variables for pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable corepack to use pnpm version specified in package.json
RUN corepack enable

# Install system essentials
RUN apt-get update && apt-get install -y \
    openssl \
    git \
    python3 \
    make \
    g++ \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Development Stage ---
# Expects project directory to be mounted on /app
FROM base AS development

# Copy package management files for pre-installing dependencies
COPY package.json pnpm-lock.yaml ./
# Use --ignore-scripts to prevent prisma/nuxt prepare during build, 
# as we will run them at runtime when the source is mounted.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Expose Nuxt dev port
EXPOSE 3000

ENV NUXT_HOST=0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3000

# Run prepare steps and migrations at runtime to ensure the .nuxt directory,
# Prisma client, and database schema are in sync with the mounted volume.
CMD pnpm run postinstall && pnpm prisma migrate dev && scripts/dev-run.sh


# --- Build Stage ---
# ... (rest of stage)
FROM base AS build

# Copy all source files
COPY . .

# Install all dependencies and build
RUN pnpm install --frozen-lockfile
# pnpm run postinstall ensures prisma client generation
RUN pnpm run postinstall
RUN pnpm run build


# --- Production Stage ---
FROM base AS production

# Set production environment
ENV NODE_ENV=production

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./
# Install ONLY the prisma CLI for migrations.
# We avoid a full 'pnpm install' here to prevent root node_modules from
# shadowing the dependencies bundled in .output/server/node_modules.
RUN pnpm add prisma --save-dev --ignore-scripts

# Copy only the output from the build stage
COPY --from=build /app/.output ./.output
# Copy prisma schema for runtime migrations
COPY --from=build /app/prisma ./prisma

# Expose Nuxt production port
EXPOSE 3000

ENV PORT=3000

# Apply pending migrations and start the production server
CMD pnpm prisma migrate deploy && node .output/server/index.mjs
