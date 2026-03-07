# CONVENTIONS.md — Code Style & Patterns

## TypeScript

- **Strict TypeScript** — no `any`. Use `unknown` with type guards.
- Prefer `interface` over `type` for public API shapes.
- Types derived from Zod schemas: `z.infer<typeof MySchema>`.
- Never use raw Prisma model types in API responses; project via `shared/models/` Row types and Prisma `select`.

```typescript
// ✅ Correct
export type UserRow = z.infer<typeof userRowSchema>

// ❌ Wrong
import type { User } from '@prisma/client'
return user  // exposes password hash etc.
```

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files (server API) | `kebab-case.method.ts` | `forgot-password.post.ts` |
| Files (components) | `PascalCase.vue` | `UserCard.vue` |
| Files (composables) | `camelCase.ts` | `useAuthFeature.ts` |
| Prisma Models | PascalCase singular | `LtiPlatform`, `PassRedemption` |
| Prisma Fields | camelCase | `createdAt`, `emailVerified` |
| Enums | PascalCase or UPPERCASE | `GlobalRole`, `CourseRole`, `TokenType` |
| DB IDs | CUID2 (`@default(cuid())`) | — |

## Server API Handlers

Every handler follows this pattern:

```typescript
// server/api/me/something.get.ts
export default defineEventHandler(async (event) => {
  // 1. Auth guard
  const session = await requireUserSession(event)
  
  // 2. Context guard (if course-scoped)
  const courseId = await requireCourseContext(event)
  
  // 3. Input validation (Zod via validation.helpers.ts)
  const body = await validateBody(event, MySchema)
  
  // 4. Delegate to server/utils/ (no inline business logic)
  const result = await doBusinessLogic(courseId, body)
  
  // 5. Return shared/models shape (never raw Prisma model)
  return result
})
```

**Guards:**
- `requireUserSession(event)` — throws 401 if not authenticated
- `requireCourseContext(event)` — throws 403 if no current course

**Validation helpers** (`server/utils/validation.helpers.ts`):
- `validateBody(event, schema)` — reads + validates request body
- `validateParams(event, schema)` — validates URL params
- `validateQuery(event, schema)` — validates query string

## Composables (Frontend)

- If logic is used in 2+ places OR exceeds 30 lines → must be a composable.
- Components never call `useFetch` directly — always via a feature composable.
- Avoid `watch`/`watchEffect`; prefer explicit function calls.
- Clean up side effects in `onUnmounted`.

```typescript
// app/composables/features/useSomething.ts
export function useSomething() {
  const { data, error, pending, refresh } = useFetch('/api/me/something')
  const computed = computed(() => data.value?.map(...))
  
  async function doAction(payload: ActionInput) {
    await $fetch('/api/me/something', { method: 'POST', body: payload })
    await refresh()
  }
  
  return { computed, error, pending, doAction }
}
```

## Zod Schema Patterns

### Shared model schemas (isomorphic)

```typescript
// shared/models/user.ts
export const userRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  globalRole: z.enum(['ADMIN', 'INSTRUCTOR', 'USER']),
  // ...
})
export type UserRow = z.infer<typeof userRowSchema>
```

### Server-side form schemas

```typescript
// shared/schemas/auth.schema.ts
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})
```

### i18n-aware client schemas (factory pattern)

```typescript
// shared/models/user.ts
export const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.email(t('auth.login.fields.email.validation.invalid')),
    password: z.string().min(1, t('auth.login.fields.password.validation.required'))
  })
```

## Prisma / Database

- All models include `createdAt` and `updatedAt`.
- Use `@@index` for frequently queried fields.
- Use `@@unique` for composite uniqueness (e.g., `[platformId, ltiSub]`).
- Explicit relation names when multiple relations exist to the same table.
- Use `///` triple-slash comments for model documentation.
- DB migration: **never `db push`** in shared environments. Use `prisma migrate dev --name <description>`.

## Error Handling

- Server: `throw createError({ statusCode, statusMessage })` (H3/Nitro)
- Custom error helpers: `validationError()`, `badRequestError()` from `server/utils/response.helpers.ts` using `ERROR_CODES` from `shared/constants/errors.ts`.
- Client: `useApiError()` composable to normalize API error responses.

## State Management

- **Global state:** Pinia stores (currently only `usePreferences.ts`, persisted).
- **Session state:** `useUserSession()` (nuxt-auth-utils) on client; `getUserSession(event)` / `setUserSession(event, ...)` on server.
- **Local component state:** `useState` for cross-component scope within a feature.
- **No prop drilling:** Use stores or `provide`/`inject` via composables.

## LTI Security

- LTI session cookies: `SameSite: none`, `Secure: true`, `HttpOnly: true` — required for iframe support.
- JWT verification via `jose` with remote JWKS — `verifyLtiToken()` in `server/utils/lti.ts`.
- Nonce stored in session, compared during launch validation.

## Git / Commits

- **Conventional Commits** enforced via commitlint (`@commitlint/config-conventional`).
- **Changelog:** `pnpm changelog` generates `CHANGELOG.md` via `git-cliff` (config: `cliff.toml`).
- **Husky:** pre-commit hook runs lint.

## Definition of Done (from GEMINI.md)

Before considering a feature complete:
1. State how it will be verified (test type).
2. Write the test first.
3. Implement the code.
4. Run lint and fix errors: `docker compose exec app-dev pnpm lint`
5. Run unit tests: `docker compose exec app-dev pnpm test:unit`
6. Confirm no regressions across all tests.
