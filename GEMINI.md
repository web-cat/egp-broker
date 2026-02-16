# 🚀 GEMINI.md: The Nuxt 4 Full-Stack Constitution

This document is the **Source of Truth** for this codebase. It merges Nuxt 4's structural requirements with strict architectural principles to ensure the system remains clean, maintainable, and extensible.

## ⚖️ I. Core Design Principles

- **Single Source of Truth (SSoT):** Every business rule or design constraint must reside in exactly one location.
- **Zero Implicit Coupling:** Components must not have "secret" knowledge of API structures or global states.
- **Layered Sovereignty:** Data flows down; events flow up. The server never trusts the client.
- **Open-Closed Principle:** Base components and Shared schemas are open for extension (e.g., Zod `.extend()`) but closed for modification to prevent "sweeping effects".
- **Fail Fast:** Validation must occur at the earliest possible boundary (API entry or Form submission) using Zod.

---

## 🏗️ II. Project Structure & Sovereignty

We adhere to the strict Nuxt 4 directory separation.

```text
├── app/                # Frontend (Presenter Layer)
│   ├── components/
│   │   ├── base/       # Stateless, context-unaware UI atoms (Pure Presenters, No stores/APIs)
│   │   └── features/   # Stateful Organisms (Orchestrators)
│   ├── composables/    # Explicit Transport (Feature-specific)
│   ├── pages/          # File-based routing
│   ├── layouts/        # Page wrappers
│   ├── middleware/     # Client-side route guards
│   └── plugins/        # Client-side initialization
├── server/             # Nitro Engine (Domain Layer & Data)
│   ├── api/            # JSON Endpoints (Inputs/Outputs ONLY - Use Zod, Strictly Projected)
│   ├── utils/          # **Core Business Logic** & Helpers (Grading, Auth, Prisma)
│   ├── routes/         # Custom server routes (e.g., RSS, Webhooks)
│   └── middleware/     # Server-side request interceptors
├── shared/             # Universal Truths (Zod schemas, TS Interfaces, Constants)
├── tests/              # Test cases
│   ├── e2e/            # E2E tests
│   └── unit/           # Unit tests
└── prisma/             # Database schema and migrations
```

### 1. The Component Hierarchy

To prevent "sweeping effects," components must follow a strict taxonomy:

- **`base/` (Atoms):** Stateless, context-unaware UI elements (Buttons, Inputs). They never access the store or perform API calls.
- **`features/` (Molecules/Organisms):** Business-specific components. These are the _only_ components allowed to interact with Pinia stores or composables.
- **`layouts/`:** Define the "shell" only. No business logic allowed.

### 2. Composable Logic

Use `composables/` to extract stateful logic from UI. If a piece of logic is used in two places, or exceeds 30 lines, it belongs in a composable.

---

## 🐳 III. Docker-based Development (Mandatory)

All commands must be executed within the `app-dev` container to ensure environment parity.

- **Startup:** `docker compose up` starts Nuxt (port 3000), Postgres, and Adminer (port 8080).
- **Execution:** `docker compose exec app-dev pnpm <command>`
- **Testing:** `docker compose exec app-dev pnpm test`
- **Migrations:** Never use `db push`. Use: `docker compose exec app-dev pnpm prisma migrate dev --name <description>`

---

## 💾 IV. Data & Security Standards

- **Interface Segregation:** Server endpoints must use Prisma `select` to return only the fields defined in a `shared/` projection.
- **Server-Side Validation:** All `server/api` entries must validate input using **Zod**. We do not trust the client.
- **The "Transport" Rule:** Components should not know the details of an `useFetch` call. Wrap data fetching in a feature-specific composable.
- **Explicit State:** Avoid "prop drilling." Use Pinia for global state, and Nuxt’s `useState` for local, cross-component state within a feature.
- **CUID2 Identifiers:** Use `@default(cuid())` for all model IDs.
- **Housekeeping:** Every model must include `createdAt`, `updatedAt` (and `deletedAt` if needed).
- **Prisma Singleton:** Database connections must be managed via `server/utils/db.ts` to prevent connection exhaustion.
- **Session Management:** Use `setUserSession(event, { user })` on the server and `useUserSession()` on the client.
- **LTI 1.3 Handshake:** Validate OIDC tokens in `server/api/lti13/launch.post.ts` before calling `setUserSession`.

---

## 🧪 V. Maintenance & Quality Assurance

**Architect’s Note:** We favor **clarity over cleverness** and **explicitness over magic**.

### 1. The Mandatory Testing Mandate

- **100% Behavioral Coverage:** Every new feature, composable, and server utility must have a Vitest unit test.
- **Contract Verification:** All schemas in `shared/` must be tested.
- **Base Component Isolation:** Tests for `base/` components must verify UI behavior without mocking external APIs.

### 2. Programming Practices

- **Defensive TypeScript:** No `any`. Use `unknown` with Type Guards if needed. Prefer `interface` over `type` for public APIs.
- **Predictable Side Effects:** Avoid `watch`/`watchEffect` in favor of explicit function calls. Clean up in `onUnmounted`.
- **Modularity via "Colocation":** Keep assets (CSS, tests, docs) close to the code. Use Nuxt Layers for large feature sets.
- **Before writing any code**:
  1. State how you will verify this change works (vitest unit test, playwright e2e test, browser check, etc.).
  2. Write the test or verification step first.
  3. Then implement the code.
  4. Run lint checks (use "docker compose exec app-dev pnpm lint"), fixing any errors and iterating until they are resolved.
  5. Run verification and iterate until it passes.
  6. Run all unit tests to confirm other features have not been affected and iterate until they all pass.

### 3. The "Reuse First" Audit

Before creating new assets, check `shared/` schemas, `app/components/base/` atoms, and `app/composables/features/` logic.

### 4. Performance & Rendering

- **Data Fetching:** Prefer `useFetch` or `useAsyncData` to prevent double-fetching.
- **Hybrid Rendering:** Use `routeRules` for SWR or `ssr: false` where appropriate.

---

## 🛠️ VI. Prisma Schema Best Practices

1. **Naming Conventions:** PascalCase singular for Models (`UserProfile`). camelCase for fields (`firstName`). PascalCase/UPPERCASE for Enums (`UserRole`).
2. **Tracking Fields:** Always include `createdAt` and `updatedAt`.
3. **Indexes:** Index frequently queried fields (`@@index`) and unique fields (`@@unique`).
4. **Explicit Relations:** Define explicit relation names for multiple connections to the same table.
5. **Documentation:** Use `///` comments for rich documentation in the Prisma Client.

---

## 📋 VII. The Definition of Done (DoD)

- [ ] **Unit Tests:** Are there Vitest files covering all new logic?
- [ ] **Projected API:** Does the server return a shared interface instead of the raw model?
- [ ] **No `any`:** Are all types derived from Zod schemas or explicit interfaces?
- [ ] **Campsite Rule:** Has the code been left cleaner than it was found?
- [ ] **Clarity:** Can a developer who joined today understand the intent of this file without reading the implementation?
- [ ] **Endpoint Rule:** If an API endpoint changes, will you only need to update the Shared Schema and the Feature Composable?
- [ ] **Database changes:** If I change the name of a database column, how many files do I have to touch? (The goal is: **One**).
