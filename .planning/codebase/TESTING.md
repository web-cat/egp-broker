# TESTING.md — Test Structure & Practices

## Testing Framework Overview

| Layer | Framework | Config |
|---|---|---|
| Unit tests | Vitest (`^3.2.0`) | `vitest.config.ts` |
| Component tests | Vitest + `@vue/test-utils` | same |
| E2E tests | Playwright (`^1.55.0`) | `playwright.config.ts` |
| Coverage | V8 (`@vitest/coverage-v8`) | `vitest.config.ts` |

## Unit Tests (`test/unit/`)

### Runner & Config

```typescript
// vitest.config.ts
{
  test: {
    environment: 'happy-dom',
    include: ['test/unit/**/*.{test,spec}.ts'],
    setupFiles: ['./test/unit/setup.ts'],
    globals: true,
    testTimeout: 10_000
  }
}
```

### Global Setup (`test/unit/setup.ts`)

Mocks all Nuxt auto-imports as globals to allow testing outside full Nuxt runtime:

```typescript
vi.mock('#app', () => ({
  useI18n: () => ({ t: (key) => key, ... }),
  useColorMode: () => ({ value: 'light', ... }),
  useRouter: () => ({ push: vi.fn(), ... }),
  useRoute: () => reactive({ path: '/', ... })
}))

// Also set on `global.*` for server-side utils
global.useI18n = ...
global.useRouter = ...
```

Suppresses Nuxt UI injection warnings during tests.

### Test File Locations

```
test/unit/
├── setup.ts                           # Global mocks (required)
├── app/
│   └── utils/date.spec.ts             # Client utility tests
├── server/
│   ├── api/
│   │   ├── admin/                     # cas-servers, courses, deployments, tools
│   │   ├── auth/disabled-password-login.test.ts
│   │   ├── lti13/config.test.ts
│   │   └── me/                        # assignments, context, pass-pools, redemptions
│   ├── constants/http.spec.ts
│   ├── services/cas.service.test.ts
│   └── utils/                         # assignments, courses, enrollments, lti, lti-*,
│                                      # pass-types, redemptions, session, users
└── shared/
    ├── constants/errors.spec.ts, validation.spec.ts
    ├── models/user.spec.ts
    ├── schemas/cas.schema.test.ts
    └── utils/abilities.spec.ts, locale.spec.ts
```

### Unit Test Patterns

**Business logic (server/utils):**

```typescript
// test/unit/server/utils/lti.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { parseCourseRole } from '@@/server/utils/lti'

vi.mock('@prisma/client', () => ({
  CourseRole: { TEACHER: 'TEACHER', STUDENT: 'STUDENT', ... }
}))

describe('LTI Utils', () => {
  describe('parseCourseRole', () => {
    it('should return STUDENT when roles is undefined', () => {
      expect(parseCourseRole(undefined)).toBe('STUDENT')
    })
    // ... priority order tests, edge cases
  })
})
```

**API handler tests:**

Handlers are tested directly by calling the handler function with a mocked H3 event (using `@nuxt/test-utils` or manual mocks).

**Shared schema tests:**

```typescript
// test/unit/shared/schemas/cas.schema.test.ts
describe('CasSchema', () => {
  it('should accept valid input', () => {
    expect(CasSchema.safeParse(validInput).success).toBe(true)
  })
  it('should reject invalid input', () => {
    expect(CasSchema.safeParse(badInput).success).toBe(false)
  })
})
```

### Mocking Patterns

**Prisma:**

```typescript
vi.mock('@@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    // ...
  }
}))
```

**Prisma enums:**

```typescript
vi.mock('@prisma/client', () => ({
  CourseRole: { TEACHER: 'TEACHER', ... }
}))
```

**Nuxt server utilities (auto-imported globals):**

```typescript
global.getUserSession = vi.fn().mockResolvedValue({ user: { id: 'u1' } })
global.createError = (opts) => Object.assign(new Error(opts.statusMessage), opts)
```

## E2E Tests (`test/e2e/`)

### Framework: Playwright

```
test/e2e/
├── auth.setup.ts         # Creates saved auth state (.auth/user.json)
├── db.setup.ts           # DB seeding before E2E run
├── app/home.spec.ts      # Home page checks
├── auth/
│   ├── login.spec.ts     # Login flow
│   └── register.spec.ts  # Registration flow
└── swagger/swagger-protection.spec.ts  # Swagger only in dev
```

### E2E Patterns

- Uses Playwright `storageState` for authenticated test scenarios.
- `db.setup.ts` seeds the database with a known test user before specs run.
- Tests target `http://localhost:3000` (dev server).

## Running Tests

```bash
# All tests
docker compose exec app-dev pnpm test

# Unit only
docker compose exec app-dev pnpm test:unit

# Unit with watch
docker compose exec app-dev pnpm test:unit:watch

# Coverage report
docker compose exec app-dev pnpm test:unit:coverage

# E2E
docker compose exec app-dev pnpm test:e2e

# E2E with UI
docker compose exec app-dev pnpm test:e2e:ui
```

## Mandatory Testing Policy (from GEMINI.md)

- **100% behavioral coverage** for every new feature, composable, and server utility.
- **Contract verification:** All `shared/schemas/` and `shared/models/` must have tests.
- **Base component isolation:** `app/components/base/` tests must not mock external APIs.
- **TDD order:** Write the test first, then implement, then lint, then run all tests.
