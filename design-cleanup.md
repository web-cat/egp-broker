# Architecture & Design Compliance Audit: Refactoring Roadmap

> **Source of Truth:** [GEMINI.md](file:///Users/edwards/git/egp-broker/GEMINI.md) — The Nuxt 4 Full-Stack Constitution  
> **Date of Audit:** October 10, 2026  
> **Scope:** Full-stack codebase audit across `app/`, `server/`, `shared/`, `prisma/`, and `test/`.

---

## Executive Summary

This audit evaluates the codebase against the architectural principles, data and security standards, directory taxonomy, and testing mandates established in [GEMINI.md](file:///Users/edwards/git/egp-broker/GEMINI.md).

### Compliance Strengths

- **Prisma Schema Fundamentals:** Models consistently implement CUID2 `@default(cuid())`, audit timestamps (`createdAt`, `updatedAt`), PascalCase singular model naming, camelCase fields, and explicit multi-relation names (e.g. `UserCurrentCourse`, `StudentReservations`, `GtaReservations`).
- **LTI 1.3 Security Handshake:** Token validation occurs via JWKS/OIDC verification prior to establishing sessions in [launch.post.ts](file:///Users/edwards/git/egp-broker/server/api/lti13/launch.post.ts).
- **Prisma Singleton:** Centralized in [db.ts](file:///Users/edwards/git/egp-broker/server/utils/db.ts) without duplicate connection leaks.
- **Base Component Isolation:** UI atoms in [app/components/base/](file:///Users/edwards/git/egp-broker/app/components/base) remain stateless and free of store/API couplings, and their unit tests do not mock external APIs.

### Primary Deficits

1. **Timezone Sovereignty Leaks (Presentation SSoT):** Components and utilities use browser-local formatting (`toLocaleDateString`, `getHours`, `getMinutes`, unpinned `Date` constructors) rather than routing through [timezone.ts](file:///Users/edwards/git/egp-broker/shared/utils/timezone.ts) locked to `America/New_York`.
2. **Missing Server-Side Validation (Fail-Fast):** Over 35 Nitro endpoints inspect `readBody(event)` or `getQuery(event)` without Zod schema validation.
3. **Transport Rule & Zero Implicit Coupling Violations:** Over 30 Vue components and pages perform direct `$fetch` or `useFetch` calls rather than delegating to feature-specific composables.
4. **Interface Segregation Deficits:** Numerous server endpoints query Prisma directly inside route handlers and return raw database models without Prisma `select` projections.
5. **Component Bloat & Inlined Stateful Logic:** Several core organisms exceed 600–1,300 lines with complex stateful business logic embedded directly in `<script setup>`.
6. **Defensive TypeScript Non-Compliance:** Over 800 instances of `as any` or `: any` are present across production and test code.
7. **Test Coverage Gaps:** Multiple shared models, feature composables, form composables, and feature components lack unit tests.

---

## Prioritized Refactoring Backlog

The refactoring items below are grouped by priority:

- **P0 (Critical):** Data integrity, timezone correctness, security validation at boundaries.
- **P1 (High):** Layered sovereignty, transport encapsulation, component decoupling, interface segregation.
- **P2 (Medium):** TypeScript strictness (`any` removal), side effect predictability (`watch` cleanup), directory restructuring.
- **P3 (Low):** Comprehensive contract verification and missing unit test coverage.

---

### Priority 0: Critical (Invariants, Security & Integrity)

#### TASK-01: Enforce Presentation Timezone Sovereignty (Course Timezone Lock) [COMPLETED]

- **Constitution Rule:** GEMINI.md § IV (_"All date formatting for user display and user date input parsing MUST route through `shared/utils/timezone.ts` locked to the course timezone (`America/New_York`). Never call `new Date().toISOString()`, `date.toLocaleDateString()`, or `date.getHours()` directly in components."_)
- **Current Violations:**
  - [app/utils/date.ts](file:///Users/edwards/git/egp-broker/app/utils/date.ts) formats dates using `toLocaleDateString` and `toLocaleTimeString` with no `timeZone` parameter, causing formatting to shift depending on the client browser's local timezone.
  - Direct calls to `toLocaleDateString` / `toLocaleTimeString` in:
    - [Student.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Student.vue#L279)
    - [GtaInterviewScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewScheduleModal.vue#L698)
    - [CbtfScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfScheduleModal.vue#L644)
    - [ProctorConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue#L823)
    - [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue#L1294)
    - [CbtfReservationsTable.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfReservationsTable.vue#L329)
    - [CbtfReservationNotesTable.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfReservationNotesTable.vue#L291)
  - Direct calls to `date.getHours()` / `date.getMinutes()` in:
    - [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue#L949) (calculating morning vs afternoon shifts based on client local time!)
    - [CbtfReservationEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/CbtfReservationEditPanel.vue#L153)
    - [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue#L323)
  - Local string parsing with `new Date(localString).toISOString()` in [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue#L375-L395), [CbtfReservationEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/CbtfReservationEditPanel.vue#L160), and [TeacherRedeemPassModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/TeacherRedeemPassModal.vue#L246).
- **Refactoring Action:**
  1. Refactor or replace [app/utils/date.ts](file:///Users/edwards/git/egp-broker/app/utils/date.ts) so all formatting delegates to [shared/utils/timezone.ts](file:///Users/edwards/git/egp-broker/shared/utils/timezone.ts) with `America/New_York` as the default timezone.
  2. Replace all ad-hoc component `formatDateTime` helpers with centralized timezone utilities (`getLocalTimeParts`, `getLocalDateString`, `combineDateAndTime`).
  3. Replace `d.getHours() < 12` logic in [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue) with `getLocalTimeParts(d).hour24 < 12`.
  4. Ensure date input parsing in admin panels converts input `YYYY-MM-DDTHH:mm` into UTC instants via `combineDateAndTime`.
- **Manual UI Inspection Required:**
  - **Student Dashboard & Modals:** Verify assignment due dates, available dates, and redemption cutoff dates show identical Eastern Time values even when simulated from a Pacific (UTC-7/8) or Central European (UTC+1/2) browser timezone.
  - **GTA Interview Console & Student Schedule Modal:** Confirm that shift windows and interview time slots partition correctly into Morning and Afternoon blocks regardless of the browser's operating system timezone.
  - **Proctor Console:** Confirm check-in timestamps, shift hours, and reservation slot intervals display accurate Eastern times.
  - **Admin Panels (Assignment & CBTF Reservation Edit Panels):** Select a date/time in the input picker, save, reload, and verify no unexpected +/- offset shifts occur.

---

#### TASK-02: Universal Server-Side Input Validation (Zod Fail-Fast) [COMPLETED]

- **Constitution Rule:** GEMINI.md § I & § IV (_"Fail Fast: Validation must occur at the earliest possible boundary (API entry or Form submission) using Zod. All server/api entries must validate input using Zod. We do not trust the client."_)
- **Current Violations:** Over 35 endpoints use unvalidated `readBody(event)` or `getQuery(event)` without Zod schemas:
  - **CBTF Admin Endpoints:**
    - [operating-hours.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/operating-hours.post.ts)
    - [exceptions.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/exceptions.post.ts)
    - [exceptions/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/exceptions/%5Bid%5D.patch.ts)
    - [shifts.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/shifts.post.ts)
    - [shifts/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/shifts/%5Bid%5D.patch.ts)
    - [shifts/batch.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/shifts/batch.post.ts)
    - [proctors.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/proctors.post.ts)
    - [facility.patch.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/facility.patch.ts)
    - [reservations/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/reservations/%5Bid%5D.patch.ts)
    - [proctors/search.get.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/proctors/search.get.ts)
  - **Proctor Endpoints:**
    - [check-in.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/check-in.post.ts)
    - [check-out.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/check-out.post.ts)
    - [lookup.get.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/lookup.get.ts)
    - [notes.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/notes.post.ts)
    - [reassign-seat.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reassign-seat.post.ts)
    - [cancel-check-in.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/cancel-check-in.post.ts)
    - [reinstate-check-out.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reinstate-check-out.post.ts)
    - [status.patch.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/status.patch.ts)
    - [reservations.get.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reservations.get.ts)
  - **GTA & Student Endpoints:**
    - [gta-shifts/index.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/gta-shifts/index.post.ts)
    - [gta-shifts/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/gta-shifts/%5Bid%5D.patch.ts)
    - [gta-shifts/batch.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/gta-shifts/batch.post.ts)
    - [gta-shifts/[id]/preview.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/gta-shifts/%5Bid%5D/preview.post.ts)
    - [interviews/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/interviews/%5Bid%5D.patch.ts)
    - [interviews/[id]/reschedule.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/interviews/%5Bid%5D/reschedule.post.ts)
    - [cbtf/reservations.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/reservations.post.ts)
    - [cbtf/reservations/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/reservations/%5Bid%5D.patch.ts)
    - [cbtf/availability.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/availability.get.ts)
  - **Passport & Student Admin Queries:**
    - [credentials.post.ts](file:///Users/edwards/git/egp-broker/server/api/passport/v1/credentials.post.ts)
    - [students/[id]/interviews.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/students/%5Bid%5D/interviews.get.ts)
    - [students/[id]/cbtf-reservations.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/students/%5Bid%5D/cbtf-reservations.get.ts)
- **Refactoring Action:**
  1. Define or reuse Zod schemas in [shared/schemas/](file:///Users/edwards/git/egp-broker/shared/schemas) for each endpoint request body and query.
  2. Replace all `readBody` with `readValidatedBody(event, schema.parse)`.
  3. Replace all `getQuery` with `getValidatedQuery(event, schema.parse)`.
  4. Validate route parameters (`id`, `courseId`, `assignmentId`) using `z.string().cuid()` / `z.string().min(1)`.
- **Manual UI Inspection Required:**
  - Submit forms with invalid / empty values across:
    - Proctor check-in and reassign seat dialogs
    - CBTF operating hours and exception dialogs
    - GTA shift creation and batch generation forms
    - Student reservation submission
  - Confirm user-friendly error feedback displays in UI without 500 server crashes.

---

#### TASK-03: Remove Disallowed `db:push` Script from Package [COMPLETED]

- **Constitution Rule:** GEMINI.md § III (_"Migrations: Never use `db push`. Use: `docker compose exec app-dev pnpm prisma migrate dev --name <description>`"_)
- **Current Violations:** [package.json](file:///Users/edwards/git/egp-broker/package.json#L35) defines `"db:push": "prisma db push"`.
- **Refactoring Action:** Remove `"db:push"` from [package.json](file:///Users/edwards/git/egp-broker/package.json). Replace with `"db:migrate": "prisma migrate dev"` or document migration command in accordance with GEMINI.md.
- **Manual UI Inspection Required:** None (developer tooling only).

---

### Priority 1: High (Layered Sovereignty, Transport & Coupling)

#### TASK-04: Enforce "The Transport Rule" (Encapsulate `$fetch` and `useFetch`) [COMPLETED]

- **Constitution Rule:** GEMINI.md § II & § IV (_"The 'Transport' Rule: Components should not know the details of an useFetch call. Wrap data fetching in a feature-specific composable. Zero Implicit Coupling: Components must not have 'secret' knowledge of API structures or global states."_)
- **Current Violations:** Multiple components and pages bypass composables to execute network requests directly:
  - **Feature Components:**
    - [Student.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Student.vue#L244) (`useFetch('/api/me/course/roster-sync-status')`)
    - [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue#L817-L824) (`useFetch` for GTAs and course shifts)
    - [AssignmentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/AssignmentRedemptionsModal.vue#L403-L455) (direct `$fetch` for redemptions, overrides, CBTF summaries)
    - [StudentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/StudentRedemptionsModal.vue#L290-L419) (direct `$fetch` for student pass balances, history, interview records)
    - [Teacher.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Teacher.vue#L437-L515) (direct `$fetch` to patch assignments and delete pass types)
    - [TeacherRedeemPassModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/TeacherRedeemPassModal.vue#L326) (direct `$fetch` to force redeem pass)
    - [CourseSettingsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/course/CourseSettingsModal.vue#L90) (direct `$fetch` to save interview location)
    - [RosterSyncModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/RosterSyncModal.vue#L151) (direct `$fetch` for sync status)
    - Admin Panels: [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue), [PassTypeEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/PassTypeEditPanel.vue), [PlatformEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/PlatformEditPanel.vue), [CourseEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/CourseEditPanel.vue), [DeploymentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/DeploymentEditPanel.vue), [GradeTranslationEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/GradeTranslationEditPanel.vue) (direct `$fetch` for CRUD mutations)
  - **Pages:**
    - [setup/[id].vue](file:///Users/edwards/git/egp-broker/app/pages/setup/%5Bid%5D.vue#L15-L42) (direct `$fetch` for tools, grade-translations, configure)
    - [admin/assignments.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/assignments.vue#L89)
    - [admin/platforms.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/platforms.vue#L93)
    - [admin/grade-translations.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/grade-translations.vue#L91)
    - [admin/index.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/index.vue#L126)
    - [admin/platforms/setup.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/platforms/setup.vue#L125)
    - Auth Pages: [login.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/login.vue), [register.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/register.vue), [forgot-password.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/forgot-password.vue), [reset-password.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/reset-password.vue), [resend-verification.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/resend-verification.vue), [verify-email.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/verify-email.vue)
- **Refactoring Action:**
  1. Relocate data-fetching and mutation routines into feature composables under [app/composables/features/](file:///Users/edwards/git/egp-broker/app/composables/features) (e.g. `useAdminAssignments`, `useAdminPlatforms`, `useAuth`, `useRosterSync`, `usePassRedemptions`).
  2. Components and pages must invoke methods exposed by the composables (e.g. `const { saveAssignment, deleteAssignment } = useAdminAssignments()`).
- **Manual UI Inspection Required:**
  - **Admin CRUD flows:** Test creating, editing, and deleting platforms, deployments, courses, assignments, and pass types. Verify table re-renders, loading spinners, and toast notifications function identically.
  - **Teacher Dashboard:** Trigger roster sync modal, change assignment pass types, open redemption details modal, and execute teacher force redemption.
  - **Student View:** Open student redemption history modal and CBTF reservation dialogs to ensure data populates correctly.
  - **Auth workflows:** Test logging in, registration, forgot-password email trigger, and email verification.

---

#### TASK-05: Enforce Interface Segregation & Projected Server APIs

- **Constitution Rule:** GEMINI.md § IV & § VII (_"Interface Segregation: Server endpoints must use Prisma select to return only the fields defined in a shared/ projection. Projected API: Does the server return a shared interface instead of the raw model? Endpoint Rule: If an API endpoint changes, will you only need to update the Shared Schema and the Feature Composable?"_)
- **Current Violations:**
  - [server/api/admin/grade-translations/index.ts](file:///Users/edwards/git/egp-broker/server/api/admin/grade-translations/index.ts): Combines GET and POST via method check, performs raw `prisma.gradeTranslation.findMany` with no `select`, and returns raw database models.
  - [server/api/me/pass-types.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types.get.ts), [pass-types.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types.post.ts), and [pass-types/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types/%5Bid%5D.patch.ts): Return raw Prisma models with `ApiResponse<any>` return signatures instead of strict projections defined in [shared/models/pass.ts](file:///Users/edwards/git/egp-broker/shared/models/pass.ts).
  - [server/api/admin/cas-servers.get.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cas-servers.get.ts): Returns raw model without `select`.
  - [server/api/admin/assignments.get.ts](file:///Users/edwards/git/egp-broker/server/api/admin/assignments.get.ts): Loads all columns without Prisma `select`.
  - [server/utils/courses.ts](file:///Users/edwards/git/egp-broker/server/utils/courses.ts): Queries using `include` instead of projected `select`.
  - [server/api/proctor/check-in.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/check-in.post.ts) and [reassign-seat.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reassign-seat.post.ts): Return raw database entities typed as `ApiResponse<any>`.
- **Refactoring Action:**
  1. Split [grade-translations/index.ts](file:///Users/edwards/git/egp-broker/server/api/admin/grade-translations/index.ts) into separate `index.get.ts` and `index.post.ts`.
  2. Implement strict Prisma `select` projections for all database queries matching shared interfaces (e.g. `PassTypeRow`, `GradeTranslationRow`, `CourseRow`, `AssignmentRow`, `CbtfReservationRow`).
  3. Ensure all endpoint event handlers declare explicit return types (`Promise<ApiResponse<T>>`) where `T` is a shared projection interface.
- **Manual UI Inspection Required:**
  - **Grade Translations:** Navigate to `/admin/grade-translations`, edit an existing grade scale, create a new one, and verify all table columns (name, maxScore, mapping count) populate correctly.
  - **Pass Types Table:** In Teacher view (`/`), verify pass type cards and settings modal show all properties properly.
  - **Proctor Console:** Verify seat assignments, status pills, and check-in times update properly after actions.

---

#### TASK-06: Decompose Monolithic Components & Extract Domain Composables (>30 Lines Rule)

- **Constitution Rule:** GEMINI.md § II.2 (_"Composable Logic: Use composables/ to extract stateful logic from UI. If a piece of logic is used in two places, or exceeds 30 lines, it belongs in a composable."_)
- **Current Violations:** Massive Vue components containing 600–1,300+ lines with large `<script setup>` sections managing filtering, sorting, multi-step modals, training simulations, and mutations:
  - [app/pages/admin/cbtf.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/cbtf.vue) (1,365 lines)
  - [app/components/features/gta/GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue) (1,313 lines)
  - [app/components/features/proctor/ProctorConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue) (1,080 lines)
  - [app/components/features/dashboard/Teacher.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Teacher.vue) (979 lines)
  - [app/components/features/teacher/TeacherGtaShiftsSection.vue](file:///Users/edwards/git/egp-broker/app/components/features/teacher/TeacherGtaShiftsSection.vue) (945 lines)
  - [app/components/features/gta/GtaInterviewScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewScheduleModal.vue) (712 lines)
  - [app/components/features/cbtf/CbtfScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfScheduleModal.vue) (681 lines)
  - [app/components/features/dashboard/StudentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/StudentRedemptionsModal.vue) (650 lines)
  - [app/components/features/dashboard/AssignmentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/AssignmentRedemptionsModal.vue) (610 lines)
- **Refactoring Action:**
  1. Extract table column definitions and filtering logic into dedicated feature composables (e.g. `useAdminCbtfShiftsTable`, `useGtaConsoleFilter`, `useTeacherAssignmentTable`).
  2. Extract sub-modal templates into smaller feature organism components colocated in their feature directory.
  3. Ensure no component exceeds reasonable size limits and all business logic blocks >30 lines reside in composables.
- **Manual UI Inspection Required:**
  - **CBTF Admin Page (`/admin/cbtf`):** Check all 4 tabs (Facility Settings, Operating Hours, Exceptions, Shifts, Reservations). Verify filtering by date/proctor, pagination, and modal dialogs open/close and save properly.
  - **GTA Interview Console (`/interviews`):** Check calendar navigation, GTA filtering, day/time slot breakdown, check-in, check-out, and notes dialogs.
  - **Proctor Console (`/proctor`):** Check live reservation board, search bar, filter tabs (scheduled, checked-in, completed), and quick check-in actions.
  - **Teacher Dashboard (`/`):** Verify assignment list, pass type management, section overview, and roster sync status indicators.

---

### Priority 2: Medium (Code Quality, Type Safety & Architecture)

#### TASK-07: Eliminate Pervasive `any` and Enforce Defensive TypeScript

- **Constitution Rule:** GEMINI.md § V.2 & § VII (_"Defensive TypeScript: No any. Use unknown with Type Guards if needed. Prefer interface over type for public APIs. Definition of Done: No any: Are all types derived from Zod schemas or explicit interfaces?"_)
- **Current Violations:** Over 800 occurrences of `as any` or `: any` across the codebase:
  - TanStack Table columns declared as `any[]` and cells typed as `({ row }: { row: any })` in:
    - [admin/cbtf.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/cbtf.vue#L823-L1347)
    - [AssignmentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/AssignmentRedemptionsModal.vue#L491-L539)
    - [StudentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/StudentRedemptionsModal.vue#L550-L615)
    - [Teacher.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Teacher.vue)
  - Server endpoints declaring return types as `Promise<ApiResponse<any>>` or `ApiResponse<any[]>`:
    - [me/pass-types.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types.get.ts#L5)
    - [me/pass-types.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types.post.ts#L6)
    - [me/pass-types/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/pass-types/%5Bid%5D.patch.ts#L6)
    - [proctor/check-in.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/check-in.post.ts#L6)
    - [proctor/reassign-seat.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reassign-seat.post.ts#L6)
  - Core server utilities casting Prisma transactions and parameters as `(tx as any)` or `(prisma as any)`:
    - [cbtf.ts](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts#L571)
    - [overrides.ts](file:///Users/edwards/git/egp-broker/server/utils/overrides.ts#L22)
    - [passport.ts](file:///Users/edwards/git/egp-broker/server/utils/passport.ts#L130)
    - [lti-tools.ts](file:///Users/edwards/git/egp-broker/server/utils/lti-tools.ts#L102)
    - [nrps.ts](file:///Users/edwards/git/egp-broker/server/utils/nrps.ts#L495)
    - [lti-launch.ts](file:///Users/edwards/git/egp-broker/server/utils/lti-launch.ts#L445)
  - Vitest test suites relying heavily on `as any` for mocking `H3Event` and Prisma models.
- **Refactoring Action:**
  1. Define explicit TanStack `ColumnDef<T>` types using shared row interfaces for all data tables.
  2. Use `Prisma.TransactionClient` instead of `(tx as any)` across database transactions.
  3. Replace API handler `any` responses with typed shared interfaces derived from Zod schemas (`z.infer<typeof ...>`).
  4. Create typed test fixture helpers (`createMockH3Event`, `mockPrisma`) to replace test-level `as any`.
- **Manual UI Inspection Required:**
  - Verify all TanStack data tables render with proper column formatting, sorting, and pagination without runtime type errors in the browser console.

---

#### TASK-08: Clean Up Unpredictable Side Effects (`watch` / `watchEffect`)

- **Constitution Rule:** GEMINI.md § V.2 (_"Predictable Side Effects: Avoid watch/watchEffect in favor of explicit function calls. Clean up in onUnmounted."_)
- **Current Violations:** Over 40 watchers in components and composables:
  - Cascading multi-ref watchers in [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue#L900,L1096,L1175).
  - Multiple watchers syncing prop state into internal form state in [TeacherRedeemPassModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/TeacherRedeemPassModal.vue#L260-L295), [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue#L327), and [CourseSettingsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/course/CourseSettingsModal.vue#L71-L78).
- **Refactoring Action:**
  1. Replace watchers used for modal reset/population with explicit open/close functions or Vue 3.4+ `defineModel` / computed setters.
  2. Where watchers are essential (e.g. route or search query updates), ensure they don't produce cascading side-effects and register cleanup functions via `onWatcherCleanup` or `onUnmounted`.
- **Manual UI Inspection Required:**
  - Open and close each modal repeatedly (Assignment edit modal, Course settings modal, Teacher force redeem pass modal, GTA shift edit modal). Confirm inputs reset properly and do not retain stale or cross-contaminated values.

---

#### TASK-09: Align Server Business Logic into `server/utils` (Consolidate `server/services`)

- **Constitution Rule:** GEMINI.md § II (_"server/utils: Core Business Logic & Helpers (Grading, Auth, Prisma)"_)
- **Current Violations:** Business logic is fragmented across two parallel directories: `server/services/` ([alert.service.ts](file:///Users/edwards/git/egp-broker/server/services/alert.service.ts), [auth.service.ts](file:///Users/edwards/git/egp-broker/server/services/auth.service.ts), [cas.service.ts](file:///Users/edwards/git/egp-broker/server/services/cas.service.ts), [email.service.ts](file:///Users/edwards/git/egp-broker/server/services/email.service.ts), [rate-limit.service.ts](file:///Users/edwards/git/egp-broker/server/services/rate-limit.service.ts), [token.service.ts](file:///Users/edwards/git/egp-broker/server/services/token.service.ts), [user.service.ts](file:///Users/edwards/git/egp-broker/server/services/user.service.ts)) and `server/utils/`.
- **Refactoring Action:**
  1. Migrate service modules into [server/utils/](file:///Users/edwards/git/egp-broker/server/utils) to take advantage of Nitro auto-imports and conform strictly to the constitution's directory sovereignty.
  2. Update import references across endpoints and tests.
- **Manual UI Inspection Required:**
  - Test authentication (login, logout, password reset, CAS callback) and verify automated alerts and email verification deliveries trigger as expected.

---

#### TASK-10: Remove Business Logic from Layout Shell

- **Constitution Rule:** GEMINI.md § II.1 (_"layouts/: Define the 'shell' only. No business logic allowed."_)
- **Current Violations:** [app/layouts/default.vue](file:///Users/edwards/git/egp-broker/app/layouts/default.vue#L102-L114) imports `useCourseContext()` and defines `handleChangeCourse = async () => await clearCourseContext()`.
- **Refactoring Action:**
  - Extract the course switcher action into a dedicated feature component (e.g. [app/components/features/course/CourseSwitchButton.vue](file:///Users/edwards/git/egp-broker/app/components/features/course)) or delegate to a header feature component.
  - Keep `default.vue` strictly focused on structure, slots, headers, and footers.
- **Manual UI Inspection Required:**
  - Click the "Change Course" button in the top navigation bar when logged in as instructor or student. Verify it successfully clears course context and redirects to the course selection view.

---

### Priority 3: Low (Test Coverage & Contract Verification)

#### TASK-11: Contract Verification for All Shared Schemas and Models

- **Constitution Rule:** GEMINI.md § V.1 (_"Contract Verification: All schemas in shared/ must be tested."_)
- **Current Violations:** Several shared models defining Zod schemas or types lack contract tests in `test/unit/shared/models/`:
  - [shared/models/deployment.ts](file:///Users/edwards/git/egp-broker/shared/models/deployment.ts) (missing test)
  - [shared/models/enrollment.ts](file:///Users/edwards/git/egp-broker/shared/models/enrollment.ts) (missing test)
  - [shared/models/platform.ts](file:///Users/edwards/git/egp-broker/shared/models/platform.ts) (missing test)
  - [shared/models/redemption.ts](file:///Users/edwards/git/egp-broker/shared/models/redemption.ts) (missing test)
  - [shared/models/stats.ts](file:///Users/edwards/git/egp-broker/shared/models/stats.ts) (missing test)
  - [shared/models/token.ts](file:///Users/edwards/git/egp-broker/shared/models/token.ts) (missing test)
- **Refactoring Action:**
  - Create Vitest contract verification tests in `test/unit/shared/models/` testing schema parse validation, default values, valid inputs, and error cases for each model.
- **Manual UI Inspection Required:** None (contract testing only).

---

#### TASK-12: Complete 100% Behavioral Coverage for Feature Composables, Organisms & Endpoints

- **Constitution Rule:** GEMINI.md § V.1 (_"100% Behavioral Coverage: Every new feature, composable, and server utility must have a Vitest unit test."_)
- **Current Violations:**
  - **Feature Composables lacking tests:**
    - [useAdminStats.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useAdminStats.ts)
    - [useAuthFeature.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useAuthFeature.ts)
    - [useCasServers.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useCasServers.ts)
    - [useCourseContext.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useCourseContext.ts)
    - [useEnrollmentsFeature.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useEnrollmentsFeature.ts)
    - [useNotifications.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useNotifications.ts)
    - [useSeo.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useSeo.ts)
    - [useToolLaunchParams.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useToolLaunchParams.ts)
    - [app/composables/common/useAbility.ts](file:///Users/edwards/git/egp-broker/app/composables/common/useAbility.ts)
    - [app/composables/common/useApiError.ts](file:///Users/edwards/git/egp-broker/app/composables/common/useApiError.ts)
    - [app/composables/forms/\*](file:///Users/edwards/git/egp-broker/app/composables/forms) (all 4 form composables)
  - **Feature Components lacking tests:**
    - [UserMenu.vue](file:///Users/edwards/git/egp-broker/app/components/features/auth/UserMenu.vue)
    - [CourseGrid.vue](file:///Users/edwards/git/egp-broker/app/components/features/course/CourseGrid.vue)
    - [CourseSettingsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/course/CourseSettingsModal.vue)
    - [PreferencesControls.vue](file:///Users/edwards/git/egp-broker/app/components/features/preferences/PreferencesControls.vue)
  - **Server Endpoints & Utils lacking tests:**
    - [server/api/proxy/\*](file:///Users/edwards/git/egp-broker/server/api/proxy) (grade passback endpoints)
    - [server/api/assignments/\*](file:///Users/edwards/git/egp-broker/server/api/assignments) (assignment config and launch endpoints)
    - [server/api/cas/\*](file:///Users/edwards/git/egp-broker/server/api/cas) (CAS endpoints)
    - [server/utils/gta-interview.ts](file:///Users/edwards/git/egp-broker/server/utils/gta-interview.ts)
    - [server/utils/lti11.ts](file:///Users/edwards/git/egp-broker/server/utils/lti11.ts)
    - [server/utils/tool-launcher.ts](file:///Users/edwards/git/egp-broker/server/utils/tool-launcher.ts)
    - [server/utils/validation.helpers.ts](file:///Users/edwards/git/egp-broker/server/utils/validation.helpers.ts)
  - **Pages lacking tests:** 18+ pages across `app/pages/` (only `admin-index.spec.ts` exists).
- **Refactoring Action:**
  - Create targeted unit tests for all uncovered composables, feature organisms, server utilities, and API endpoints until 100% behavioral coverage is achieved.
- **Manual UI Inspection Required:**
  - None (automated Vitest validation).

---

## UI Manual Inspection Matrix

When executing the refactoring tasks above, use this matrix to guide manual visual verification across the application:

| Feature / Module                            | Affected Files & Components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | What to Manually Inspect in the UI                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timezone Presentation & Date Formatting** | [date.ts](file:///Users/edwards/git/egp-broker/app/utils/date.ts), [Student.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Student.vue), [CbtfScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfScheduleModal.vue), [GtaInterviewScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewScheduleModal.vue), [ProctorConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue), [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue) | 1. Change your operating system or browser timezone (e.g. to America/Los_Angeles or Europe/Paris).<br>2. Load Student Dashboard, CBTF Schedule Modal, GTA Schedule Modal, and Proctor Console.<br>3. Verify all date and time labels strictly display Eastern Time (`America/New_York`) without shifting hours.<br>4. Verify morning/afternoon shift slots divide at 12:30 PM Eastern Time. |
| **Admin Panels Date Pickers**               | [AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue), [CbtfReservationEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/CbtfReservationEditPanel.vue)                                                                                                                                                                                                                                                                                                                                                                                                      | 1. Open Assignment Edit modal at `/admin/assignments`.<br>2. Edit due date, available from, and accept until.<br>3. Save and reload the page.<br>4. Confirm the persisted time matches the chosen wall-clock time in Eastern timezone.                                                                                                                                                      |
| **Server-Side Validation Errors**           | [operating-hours.post.ts](file:///Users/edwards/git/egp-broker/server/api/admin/cbtf/operating-hours.post.ts), [check-in.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/check-in.post.ts), [reassign-seat.post.ts](file:///Users/edwards/git/egp-broker/server/api/proctor/reassign-seat.post.ts), [gta-shifts/batch.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/courses/%5BcourseId%5D/gta-shifts/batch.post.ts)                                                                                                                                                                                                         | 1. Attempt submitting invalid forms (e.g. invalid time formats, out-of-range seat numbers, duplicate shifts).<br>2. Ensure the UI intercepts or receives 400 Bad Request with field-level error messages rather than unhandled 500 internal server errors.                                                                                                                                  |
| **Transport Rule: Feature Composables**     | [AssignmentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/AssignmentRedemptionsModal.vue), [StudentRedemptionsModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/StudentRedemptionsModal.vue), [Teacher.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/Teacher.vue), [TeacherRedeemPassModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/dashboard/TeacherRedeemPassModal.vue)                                                                                                                                              | 1. In Teacher view, open Assignment Redemptions modal and Student Redemptions modal.<br>2. Confirm data loads with proper loading skeletons.<br>3. Trigger Teacher Force Redeem Pass: confirm modal closes on success, pass balance updates, and toast confirms redemption.                                                                                                                 |
| **Admin CRUD Pages**                        | [admin/platforms.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/platforms.vue), [admin/assignments.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/assignments.vue), [admin/grade-translations.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/grade-translations.vue), [admin/courses.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/courses.vue), [admin/deployments.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/deployments.vue)                                                                                                                                                                 | 1. Navigate to `/admin` subpages.<br>2. Verify data tables render rows correctly.<br>3. Perform Create, Edit, and Delete actions for each entity.<br>4. Check that data tables refresh without full page reloads.                                                                                                                                                                           |
| **Decomposed Monoliths: CBTF Admin**        | [cbtf.vue](file:///Users/edwards/git/egp-broker/app/pages/admin/cbtf.vue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 1. Navigate to `/admin/cbtf`.<br>2. Test tab transitions between Facility, Operating Hours, Exceptions, Shifts, and Reservations.<br>3. Verify search filters, date range filters, and pagination controls work smoothly.                                                                                                                                                                   |
| **Decomposed Monoliths: GTA Console**       | [GtaInterviewConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/gta/GtaInterviewConsole.vue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 1. Navigate to `/interviews`.<br>2. Switch between day and week views.<br>3. Filter by GTA and shift.<br>4. Perform student check-in, check-out, and note taking.<br>5. Confirm UI updates immediately without stale state.                                                                                                                                                                 |
| **Decomposed Monoliths: Proctor Console**   | [ProctorConsole.vue](file:///Users/edwards/git/egp-broker/app/components/features/proctor/ProctorConsole.vue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 1. Navigate to `/proctor`.<br>2. Check student lookup by ID/name.<br>3. Execute Quick Check-in, Reassign Seat, and Check-out.<br>4. Test Training Mode toggle and ensure simulation data resets cleanly.                                                                                                                                                                                    |
| **Layout Shell & Course Switcher**          | [default.vue](file:///Users/edwards/git/egp-broker/app/layouts/default.vue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 1. Log in as an instructor enrolled in multiple courses.<br>2. Click "Change Course" in the top navigation bar.<br>3. Verify you are smoothly redirected to the course picker `/` without console errors.<br>4. Choose another course and confirm dashboard updates to the selected course.                                                                                                 |
| **Authentication Flows**                    | [login.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/login.vue), [register.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/register.vue), [forgot-password.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/forgot-password.vue), [reset-password.vue](file:///Users/edwards/git/egp-broker/app/pages/auth/reset-password.vue)                                                                                                                                                                                                                                                                                                  | 1. Test local login with valid credentials.<br>2. Test login with invalid credentials and verify error alerts.<br>3. Test "Forgot Password" request and password reset token link.<br>4. Verify user avatar and dropdown menu in the top right corner.                                                                                                                                      |

---

### ✅ Task 02 Complete & Committed

**TASK-02: Universal Server-Side Input Validation (Zod Fail-Fast)** is complete, verified, and committed.

#### Summary of Work Completed:

1. **Endpoint Refactoring**: Refactored all 24 unvalidated or ad-hoc endpoints across CBTF Admin, Proctor Console, GTA/Student scheduling, and Passport API to use `readValidatedBody` and `getValidatedQuery`.
2. **Schema Contracts**: Added centralized, reusable schemas in:
   - [shared/schemas/cbtf.schema.ts](file:///Users/edwards/git/egp-broker/shared/schemas/cbtf.schema.ts) (`proctorReservationActionSchema`, `proctorStatusInputSchema`, `proctorLookupQuerySchema`)
   - [shared/schemas/course.schema.ts](file:///Users/edwards/git/egp-broker/shared/schemas/course.schema.ts) (`studentContextQuerySchema`)
   - [shared/models/passport.ts](file:///Users/edwards/git/egp-broker/shared/models/passport.ts) (`passPortCredentialsQuerySchema`)
3. **Vitest Verification**: Updated test mocks and verified the full test suite inside Docker: **169 test files passed (1,102 passed, 0 failed)**.
4. **Documentation**: Marked complete in [design-cleanup.md](file:///Users/edwards/git/egp-broker/design-cleanup.md).
5. **Git Commit**: Committed on `main` via `b7ccc5e` (`fix(api): add zod validation across endpoints`) following conventional commit and lint-staged guidelines.

---

### ✅ Task 03 Complete & Verified

**TASK-03: Remove Disallowed `db:push` Script from Package** is complete and verified.

#### Summary of Work Completed:

1. **Script Replacement**: Removed `"db:push": "prisma db push"` from [package.json](file:///Users/edwards/git/egp-broker/package.json) and replaced it with `"db:migrate": "prisma migrate dev"`, complying with GEMINI.md § III.
2. **Documentation**: Updated [README.md](file:///Users/edwards/git/egp-broker/README.md) scripts table to document `db:migrate` instead of `db:push`.
3. **Verification**: Full unit test suite verified passing.

---

### ⏸️ Status & Next Steps

Next task in the roadmap:

- **TASK-04**: Enforce "The Transport Rule" (Encapsulate `$fetch` and `useFetch` across feature components and admin pages into dedicated composables).
