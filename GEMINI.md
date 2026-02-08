This `GEMINI.md` file is designed to serve as a "Source of Truth" for any developer (or AI collaborator) working on this codebase. It emphasizes the structural changes in Nuxt 4, particularly the new `app/` directory and Nitro-first server patterns.

---

# 🚀 GEMINI.md: Nuxt 4 Full-Stack Best Practices

This document outlines the architectural standards and software engineering principles for this project. Adhering to these ensures maximum maintainability, type safety, and performance.

---

## 🐳 0. Docker-based Development (Mandatory)

This project is developed and executed entirely within Docker. **All development commands must be run inside the `app-dev` container.**

- **Initialize**: `cp .env.example .env` and configure accordingly.
- **Startup**: `docker compose up` starts the Nuxt app (port 3000), Postgres, and Adminer (port 8080).
- **Interactive Terminal**: `docker compose exec app-dev bash`
- **Running Commands**:
  ```bash
  docker compose exec app-dev pnpm install <package>
  docker compose exec app-dev pnpm prisma migrate dev
  docker compose exec app-dev pnpm test
  ```
- **Committing**: Ensure the container is running when you `git commit`, as Husky hooks run linting inside the container.

---

## 🏗️ 1. Project Structure (The Nuxt 4 Way)

Nuxt 4 introduces a strict separation between the frontend application and the server engine.

```text
├── app/                # All frontend-facing code
│   ├── components/     # Auto-imported Vue components
│   ├── composables/    # Business logic & state (auto-imported)
│   ├── pages/          # File-based routing
│   ├── layouts/        # Page wrappers
│   ├── middleware/     # Client-side route guards
│   └── plugins/        # Client-side initialization
├── server/             # Nitro Engine (Backend)
│   ├── api/            # JSON Endpoints
│   ├── routes/         # Custom server routes (e.g., RSS, Webhooks)
│   ├── middleware/     # Server-side request interceptors
│   └── utils/          # Server-only helper functions (Prisma, Auth)
├── shared/             # Code shared by both App and Server (Types, Constants)
└── prisma/             # Database schema and migrations

```

---

## 🔐 2. Authentication & Security

We use **`nuxt-auth-utils`** for sealed, session-based authentication.

- **Session Management:** Always use `setUserSession(event, { user })` on the server and the `useUserSession()` composable on the client.
- **Environment Variables:** Sensitive keys (like `NUXT_SESSION_PASSWORD`) must never be hardcoded. Use `.env` and access them via `runtimeConfig`.
- **LTI 1.3 Handshake:** For LMS integration, validate OIDC tokens in `server/api/lti13/launch.post.ts` before calling `setUserSession`.

---

## 💾 3. Data Layer (Prisma & Nitro)

- **Singleton Pattern:** Database connections must be managed as a singleton in `server/utils/db.ts` to prevent "Too many connections" errors during HMR.
- **Type Safety:** Always run `pnpm prisma generate` after schema changes. Use the generated types in your server handlers.
- **Validation:** Use **Zod** for validating incoming request bodies in server handlers.

```typescript
// Example: server/api/user.post.ts
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(
    event,
    z.object({
      email: z.string().email()
    }).parse
  )

  return await prisma.user.create({ data: body })
})
```

---

## ⚡ 4. Performance & Rendering

Nuxt 4 is high-performance by default; don't break it with poor patterns.

- **Data Fetching:** Prefer `useFetch` or `useAsyncData` over raw `$fetch` in components to prevent double-fetching during Hydration.
- **Hybrid Rendering:** Use `routeRules` in `nuxt.config.ts` to define SWR (Stale-While-Revalidate) for content-heavy pages and `ssr: false` for purely administrative dashboards.
- **Server Components:** Use `.server.vue` components for complex UI parts that don't need interactivity to reduce the client-side JS bundle.

---

## 🛠️ 5. Maintenance & Quality

- **Strict TypeScript:** Ensure `typescript.typeCheck: true` is enabled in `nuxt.config.ts`. Avoid `any` at all costs.
- **Error Handling:** Use `throw createError({ statusCode: 404, message: '...' })` in server routes to ensure the frontend receives a clean error object.
- **Testing:** Place unit tests in `tests/` and use `@nuxt/test-utils` for E2E testing of the Nitro server and Vue components.

---

## 📋 6. Developer Workflow

> [!IMPORTANT]
> **Schema Changes & Migrations**: Never use `db push` for permanent schema changes. Whenever a model is added or a field is modified, you **must** generate a Prisma migration:
> `docker compose exec app-dev pnpm prisma migrate dev --name <description>`

1.  **Syncing Schema**: Use migrations for development and production consistency.
2.  **Code Style**: ESLint runs via Husky hooks inside the container. You can also run it manually: `docker compose exec app-dev pnpm run lint`.
3.  **Local Dev**: Always run `docker compose up`. Nuxt 4's file watcher is optimized for the `app/` directory mounted inside the container.

---

> **Tip for Gemini/AI Collaborators:** When adding new features, always check `server/utils/` for existing database helpers before creating new ones. Ensure all new API endpoints follow the `defineEventHandler` pattern.

---

**Would you like me to generate a specific `server/utils/db.ts` file that follows the Prisma singleton pattern mentioned in Section 3?**
