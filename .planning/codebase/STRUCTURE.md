# STRUCTURE.md — Directory Layout & Key Locations

## Root Layout

```
egp-broker/
├── app/                     # Frontend (Nuxt Presenter Layer)
├── server/                  # Backend (Nitro Domain Layer)
├── shared/                  # Isomorphic contracts (Zod, types, constants)
├── prisma/                  # DB schema + migrations + seed
├── lib/                     # Prisma singleton (lib/prisma.ts)
├── test/                    # All tests
│   ├── unit/                # Vitest unit tests
│   └── e2e/                 # Playwright E2E tests
├── design-system/           # Design tokens / Tailwind config
├── docs/                    # Documentation
├── i18n/                    # Locale files (en/, fr/)
├── public/                  # Static assets
├── scripts/                 # Dev helper scripts
├── templates/               # Email Handlebars templates (Nitro server assets)
├── .planning/               # AI planning artifacts
├── .docker/                 # Docker config files
├── nuxt.config.ts           # Nuxt + Nitro + module configuration
├── vitest.config.ts         # Vitest test runner config
├── playwright.config.ts     # Playwright E2E config
├── prisma.config.ts         # Prisma config (migrations dir)
├── eslint.config.mts        # ESLint flat config
├── .prettierrc.yaml         # Prettier config
├── docker-compose.yml       # Dev environment (app-dev, postgres, adminer)
├── Dockerfile               # Production image
├── GEMINI.md                # Architectural constitution / coding rules
└── package.json             # Scripts, dependencies
```

## `app/` — Frontend

```
app/
├── app.vue                  # Root component (NuxtLayout + NuxtPage)
├── app.config.ts            # App-level config (UI theme tokens)
├── error.vue                # Global error page
├── assets/
│   └── css/main.css         # Global CSS entrypoint (Tailwind + custom)
├── components/
│   ├── base/                # Stateless UI atoms (no store/API access)
│   └── features/            # Stateful organisms (stores + composables OK)
├── composables/
│   ├── common/              # Shared: useAbility.ts, useApiError.ts
│   ├── features/            # Business feature composables (useFetch wrappers)
│   │   ├── admin/           # useAdminCasServers, useAdminCrud, useAdminPlatforms, useAdminTools
│   │   ├── useAuthFeature.ts
│   │   ├── useCourseContext.ts
│   │   ├── useNotifications.ts
│   │   ├── useSeo.ts
│   │   ├── useStudentDashboard.ts
│   │   └── useTeacherDashboard.ts
│   ├── forms/               # Form state + Zod validation wrappers
│   │   ├── useForgotPasswordForm.ts
│   │   ├── useLoginForm.ts
│   │   ├── useRegisterForm.ts
│   │   └── useResetPasswordForm.ts
│   └── stores/
│       └── usePreferences.ts  # Pinia (persisted)
├── layouts/                 # default.vue, etc.
├── middleware/              # passwordLogin.ts (client-side route guard)
├── pages/
│   ├── index.vue            # Home / dashboard (student & teacher views)
│   ├── admin.vue            # Admin shell layout
│   ├── admin/               # Admin sub-pages (courses, platforms, tools, deployments, cas-servers, assignments)
│   └── auth/                # login, register, forgot-password, reset-password, verify-email, resend-verification
├── plugins/                 # Client-side initialization
├── stores/                  # usePreferences.ts (pinia, persisted)
└── utils/                   # Client-side utility functions (e.g. date formatting)
```

## `server/` — Backend

```
server/
├── api/
│   ├── admin/               # Admin-only CRUD endpoints
│   │   ├── assignments.[get|post].ts
│   │   ├── assignments/[id].patch.ts
│   │   ├── cas-servers.[get|post].ts
│   │   ├── cas-servers/[id].[delete|put].ts
│   │   ├── courses.[get|post].ts
│   │   ├── courses/[id].patch.ts
│   │   ├── deployments.[get|post].ts
│   │   ├── deployments/[id].patch.ts
│   │   ├── platforms.get.ts
│   │   ├── stats.get.ts
│   │   ├── tools.[get|post].ts
│   │   └── tools/[id].[patch|delete].ts
│   ├── auth/                # Email/password auth (feature-flagged)
│   │   ├── login.post.ts, logout.post.ts, me.get.ts
│   │   ├── register.post.ts, verify-email.post.ts, resend-verification.post.ts
│   │   └── forgot-password.post.ts, reset-password.post.ts
│   ├── cas/                 # CAS SSO
│   │   ├── login.get.ts, callback.get.ts, servers.get.ts
│   ├── dev/                 # Dev-only endpoints
│   │   └── mock-launch.post.ts
│   ├── docs/                # Swagger UI + JSON spec
│   │   ├── index.get.ts, ui.get.ts
│   ├── lti13/               # LTI 1.3 OIDC + launch
│   │   ├── login.get.ts, launch.post.ts
│   │   ├── config.get.ts, jwks.get.ts
│   └── me/                  # Authenticated user endpoints
│       ├── assignments.[get|post].ts
│       ├── assignments/[id].patch.ts
│       ├── assignments/sync.post.ts
│       ├── context.[post|delete].ts
│       ├── enrollment.get.ts, enrollments.get.ts
│       ├── pass-pools.get.ts
│       ├── pass-types.[get|post].ts
│       ├── pass-types/[id].[patch|delete].ts
│       └── redemptions.get.ts (+ more)
├── constants/               # HTTP status codes, server error codes
├── middleware/              # Server-side interceptors
├── services/                # Infrastructure: CAS service
├── tasks/                   # Nitro scheduled tasks (cleanup:*)
├── templates/               # Email Handlebars templates
├── types/                   # Server-only TypeScript types
└── utils/                   # Business logic helpers (auto-imported)
    ├── assignments.ts, courses.ts, enrollments.ts
    ├── lti.ts, lti-platforms.ts, lti-deployments.ts, lti-tools.ts
    ├── pass-types.ts, redemptions.ts
    ├── users.ts, session.ts, canvas.ts, gravatar.ts
    ├── email-transporter.helpers.ts, logger.helpers.ts
    ├── response.helpers.ts, validation.helpers.ts
```

## `shared/` — Isomorphic Contracts

```
shared/
├── auth.d.ts                # nuxt-auth-utils session type augmentation
├── constants/
│   ├── errors.ts            # Error code constants (ERROR_CODES)
│   └── validation.ts        # TEXT_FIELD_LIMITS, VALIDATION_PATTERNS
├── models/                  # API response interfaces + Zod schemas
│   ├── user.ts              # UserRow schema, auth form schemas, toPublicUser()
│   ├── assignment.ts, course.ts, deployment.ts, enrollment.ts
│   ├── pass.ts, platform.ts, redemption.ts, stats.ts, token.ts, tool.ts
├── schemas/                 # Input validation schemas for server/api
│   ├── admin.schema.ts, auth.schema.ts, cas.schema.ts
│   ├── common.schema.ts, course.schema.ts, dev.schema.ts
├── types/
│   ├── api.ts               # Generic API response types
│   └── preferences.ts       # User preferences
└── utils/
    ├── abilities.ts         # CASL ability rules (shared between client and server)
    └── locale.ts            # Locale utilities
```

## `test/` — Tests

```
test/
├── unit/
│   ├── setup.ts             # Global mocks: #app, i18n, router, color mode
│   ├── app/utils/           # Client utility tests
│   ├── server/
│   │   ├── api/             # API handler tests (admin/, auth/, lti13/, me/)
│   │   ├── constants/       # HTTP constants tests
│   │   ├── services/        # CAS service test
│   │   └── utils/           # Business logic unit tests (lti, users, sessions, etc.)
│   └── shared/              # Schema, model, constant, and utility tests
└── e2e/
    ├── auth.setup.ts        # Playwright auth state setup
    ├── db.setup.ts          # DB seeding for E2E
    ├── app/home.spec.ts     # Home page E2E
    ├── auth/                # Login + register E2E specs
    └── swagger/             # Swagger protection E2E spec
```

## Key Configuration Files

| File | Purpose |
|---|---|
| `nuxt.config.ts` | Nuxt, Nitro, i18n, security, route rules, runtime config |
| `vitest.config.ts` | Vitest environment (`happy-dom`), path aliases, setup file |
| `playwright.config.ts` | E2E browser config, projects, auth state |
| `prisma/schema.prisma` | DB models, enums, relations |
| `GEMINI.md` | Architectural constitution and mandatory coding rules |
| `lib/prisma.ts` | Prisma singleton import |
| `.env.common` | Shared env var defaults (Docker) |
| `.env.example` | Template for local `.env` |

## Path Aliases

| Alias | Resolves To |
|---|---|
| `~`, `@` | `./app` |
| `~~`, `@@` | `.` (project root) |
| `#shared` | `./shared` |
| `#app` | `nuxt app` (mocked in tests) |
