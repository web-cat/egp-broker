# STACK.md — Technology Stack

## Runtime & Language

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | ^5.9.2 |
| Runtime | Node.js (via Docker) | — |
| Package Manager | pnpm | 10.19.0 |

## Framework

- **Nuxt 4** (`nuxt@4.2.0`) — Full-stack framework. `compatibilityDate: '2025-10-22'`.
- **Nitro** — Built-in Nuxt server engine powering all `server/` code (H3 handlers, scheduled tasks, server-side utils).
- **Vue 3** — Frontend, composition API throughout.
- **Vite 6** — Build tool.

## Frontend Stack

| Concern | Library |
|---|---|
| UI Components | `@nuxt/ui@4.1.0` (built on TailwindCSS v4 + Radix Vue) |
| CSS | TailwindCSS v4 (`@tailwindcss/vite@4.0.0`), global entrypoint `app/assets/css/main.css` |
| State Management | Pinia v3 (`@pinia/nuxt`) + `pinia-plugin-persistedstate` |
| Authorization (client) | CASL (`@casl/ability` + `@casl/vue`) |
| Internationalization | `@nuxtjs/i18n@^10.0.6` — `fr` default, `en` supported, `prefix` strategy |
| SEO | `@nuxtjs/seo@^3.1.0` |
| Icons | Lucide, Simple Icons, OpenMoji — bundled server-side via `@nuxt/ui` icon config |
| Routing | File-based (Nuxt pages directory) |
| Images | `@nuxt/image@1.11.0` |

## Backend / Server Stack

| Concern | Library |
|---|---|
| Server Framework | Nitro (H3) — handlers in `server/api/` and `server/routes/` |
| Database ORM | Prisma (`@prisma/client@6.18.0`, `prisma@^6.14.0`) |
| Database | PostgreSQL (connection via `NUXT_DATABASE_URL`) with `uuid-ossp` extension |
| Session & Auth | `nuxt-auth-utils@^0.5.23` — `getUserSession()` / `setUserSession()` |
| JWT / LTI 1.3 | `jose@^6.1.3` (JWKS remote key set, JWT verify) |
| Email | `nodemailer@^7.0.10` with Handlebars templates |
| Security | `nuxt-security@^2.4.0` — CSP, rate limiting (150 req / 5 min), hides `X-Powered-By` |
| Templating | Handlebars (`^4.7.8`) for email templates |

## Validation

- **Zod v4** (`^4.0.17`) — single source of truth for all input validation.
- `shared/schemas/` — server-only schemas (body, query, params).
- `shared/models/` — isomorphic Zod schemas used on both client and server.
- `server/utils/validation.helpers.ts` — wrappers `validateBody`, `validateParams`, `validateQuery`.

## Nitro Scheduled Tasks (cron)

| Schedule | Task |
|---|---|
| `*/30 * * * *` | `cleanup:tokens` |
| `0 3 * * *` | `cleanup:unverified-users` |
| `0 * * * *` | `cleanup:login-attempts` |

## Dev & Tooling

| Tool | Purpose |
|---|---|
| Docker Compose | Dev environment — `app-dev` (Nuxt on :3000), Postgres, Adminer (:8080) |
| Husky | Git hooks (pre-commit lint) |
| Commitlint | Conventional commits |
| ESLint 9 | Linting (`eslint.config.mts`) via `@nuxt/eslint` |
| Prettier | Formatting (`.prettierrc.yaml`) |
| git-cliff | CHANGELOG generation |
| swagger-jsdoc | OpenAPI docs generation (served via `/api/docs`) |

## Key npm Scripts

```bash
pnpm dev                  # Start dev server
pnpm test                 # unit + e2e
pnpm test:unit            # vitest run
pnpm test:e2e             # playwright test
pnpm lint                 # prettier + eslint --fix
pnpm db:generate          # prisma generate
pnpm db:seed              # prisma db seed
```

> **All commands must run inside the `app-dev` Docker container:**
> `docker compose exec app-dev pnpm <command>`
