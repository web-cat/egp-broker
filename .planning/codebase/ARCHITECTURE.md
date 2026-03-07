# ARCHITECTURE.md — System Architecture

## Pattern: Nuxt 4 Layered Full-Stack

```
┌──────────────────────────────────────────────────────────────┐
│  LMS (Canvas)           External Systems (CAS, Email, Canvas API) │
└────────────┬────────────────────────────────────────▲────────┘
             │ LTI 1.3 launch / OIDC                  │ SMTP / REST
             ▼                                         │
┌──────────────────────────────────────────────────────────────┐
│                      NITRO (server/)                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ server/  │  │ server/  │  │ server/   │  │ server/   │  │
│  │  api/    │  │ utils/   │  │ services/ │  │  tasks/   │  │
│  │ (Routes) │  │ (Domain) │  │ (Infra)   │  │ (Cron)    │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └─────┬─────┘  │
│       └─────────────┴───────────────┴───────────────┘        │
│                            Prisma ORM                        │
│                         ┌───────────┐                        │
│                         │ PostgreSQL│                        │
│                         └───────────┘                        │
└─────────────────────────────┬────────────────────────────────┘
                              │ SSR / API calls
┌─────────────────────────────▼────────────────────────────────┐
│                       VUE (app/)                             │
│  Pages → Feature Components → Base Components                │
│  Pinia Stores ← Composables (Transport Layer)                │
└──────────────────────────────────────────────────────────────┘
                   ▲ shared/ ▼
            (Zod schemas, interfaces, constants)
```

## Layers & Sovereignty Rules

### 1. `shared/` — Universal Truths

The only layer accessible by **both** server and client. Contains:
- **Zod schemas** (`shared/schemas/`) — input validation contracts
- **Interface models** (`shared/models/`) — API response shapes (e.g., `UserRow`)
- **Constants** (`shared/constants/`) — validation limits, error codes
- **Utilities** (`shared/utils/`) — `abilities.ts` (CASL rules), `locale.ts`
- **Types** (`shared/types/`) — cross-boundary TypeScript types

> **Rule:** If an API endpoint changes, only the `shared/` schema + the feature composable need updating.

### 2. `server/` — Domain Layer (Nitro Engine)

- **`server/api/`** — HTTP route handlers (`defineEventHandler`). **Input/output only** — no business logic inline. Delegates to `server/utils/`.
- **`server/utils/`** — Core business logic (Prisma queries, LTI helpers, email, Canvas sync). Auto-imported by Nitro.
- **`server/services/`** — Infrastructure services (CAS validation).
- **`server/tasks/`** — Nitro scheduled tasks (`cleanupTokens`, `cleanupUnverifiedUsers`, `cleanupLoginAttempts`).
- **`server/templates/`** — Email Handlebars templates (served as Nitro server assets).
- **`server/constants/`** — Server-only constants (HTTP codes, etc.).
- **`server/middleware/`** — Server-side request interceptors.
- **`lib/prisma.ts`** — Prisma singleton (prevents connection pool exhaustion).

### 3. `app/` — Presenter Layer (Vue/Nuxt)

- **`app/pages/`** — File-based routing. 15 public/auth pages + admin section.
- **`app/components/base/`** — Stateless atoms (no store/API access).
- **`app/components/features/`** — Stateful organisms (allowed to use Pinia stores + composables).
- **`app/composables/`** — Three subcategories:
  - `common/` — Shared utilities (`useAbility`, `useApiError`)
  - `features/` — Business feature logic, wraps `useFetch` calls
  - `forms/` — Form state + validation wrappers
- **`app/stores/`** — Pinia: only `usePreferences.ts` (persisted). Session state via `nuxt-auth-utils`.
- **`app/layouts/`** — Shell only (no business logic).
- **`app/middleware/`** — Client-side route guards.
- **`app/plugins/`** — Client-side initialization.

## Key Data Flows

### LTI 1.3 Launch (Happy Path)

```
Canvas → POST /api/lti13/launch
  → readValidatedBody (LtiLaunchSchema)
  → getUserSession (verify nonce/state)
  → prisma.ltiPlatform.findUnique
  → verifyLtiToken (JWKS remote, jose)
  → prisma.$transaction:
      upsert LtiDeployment
      find/create User + LtiIdentity
      upsert Course + Enrollment
      upsert Assignment
  → syncAssignmentEligibility (post-tx)
  → setUserSession({ user, lti })
  → sendRedirect(targetLinkUri)
```

### API Endpoint Pattern

```typescript
// server/api/me/something.get.ts
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)   // auth guard
  const courseId = await requireCourseContext(event) // context guard
  const body = await validateBody(event, MySchema)   // zod validation
  const result = await doBusinessLogic(courseId)     // server/utils/
  return result                                       // shared/models shape
})
```

### Frontend Data Transport Pattern

```typescript
// app/composables/features/useSomething.ts
export function useSomething() {
  const { data, error, refresh } = useFetch('/api/me/something')
  // ...computed, actions
  return { data, error, refresh }
}
// Components never call useFetch directly
```

## Authorization

- **Server:** `requireUserSession(event)` (nuxt-auth-utils) for auth guard. `GlobalRole` checked inline for admin endpoints.
- **Client:** CASL abilities defined in `shared/utils/abilities.ts`, consumed via `useAbility()` composable.
- **Feature flag:** `NUXT_PUBLIC_ENABLE_PASSWORD_LOGIN` — disables email/password login endpoints and UI when `false`. Middleware `passwordLogin.ts` guards client-side routes.

## Scheduled Task Architecture

Nitro experimental tasks with cron scheduling in `nuxt.config.ts`:
```typescript
// server/tasks/cleanup/tokens.ts
export default defineTask({ run: async () => { ... } })
```
