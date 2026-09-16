---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: GTA Feed & Interview Status Endpoints + Console Feature Composable

## Objective

Build the backend API endpoints and client feature composable for the GTA on-duty interview console: allow GTAs and instructors to view their interview feed (expected arrivals, active in-progress interviews, and completed/missed interviews), check students in, check students out, record observation/grading notes, and mark no-shows.

## Context

- `.gsd/SPEC.md` (Goal 5)
- `.gsd/REQUIREMENTS.md` (REQ-507, REQ-508, REQ-509)
- `server/utils/gta-interview.ts`
- `shared/schemas/gta-interview.schema.ts`
- `server/api/me/courses/[courseId]/interviews/`
- `app/composables/features/useGtaInterviewConsole.ts`

## Tasks

<task type="auto">
  <name>Create GTA Interview Feed & Status Patch Endpoints</name>
  <files>
    server/api/me/courses/[courseId]/interviews/index.get.ts,
    server/api/me/courses/[courseId]/interviews/[id].patch.ts
  </files>
  <action>
    1. Create `server/api/me/courses/[courseId]/interviews/index.get.ts`:
       - Authenticate user session. Verify user is enrolled in `courseId` as `TA`, `TEACHER`, `INSTRUCTOR`, or global `ADMIN`.
       - Accept optional query parameter `date` (defaults to today in local/course timezone) or `all=true`.
       - For a `TA`, retrieve reservations assigned to them (`gtaId = user.id`) for the course. For an instructor/admin, allow viewing all course interview reservations or filtering by `gtaId`.
       - Query Prisma `gtaInterviewReservation` including student (`id`, `firstName`, `lastName`, `email`), assignment (`id`, `title`), and gta (`id`, `firstName`, `lastName`).
       - Order by `startTime` ascending.
       - Return `{ statusCode: 200, data: reservations }`.
    2. Create `server/api/me/courses/[courseId]/interviews/[id].patch.ts`:
       - Authenticate user session. Verify enrollment as `TA`, `TEACHER`, or `ADMIN`.
       - Validate request body using `updateGtaInterviewReservationInputSchema` (`status`, `notes`).
       - Find reservation: must belong to the course; caller must be either the assigned `gtaId` or a course instructor/admin.
       - If `status === 'CHECKED_IN'`, set `checkedInAt = new Date()`.
       - If `status === 'CHECKED_OUT'` or `status === 'COMPLETED'`, set `checkedOutAt = new Date()`.
       - If `status === 'MISSED'`, mark student as no-show.
       - Update notes if provided.
       - Return updated reservation DTO.
  </action>
  <verify>test -f "server/api/me/courses/[courseId]/interviews/index.get.ts" && test -f "server/api/me/courses/[courseId]/interviews/[id].patch.ts"</verify>
  <done>GTA interview feed and status patch endpoints are implemented with proper role authorization and timestamp tracking.</done>
</task>

<task type="auto">
  <name>Create useGtaInterviewConsole Feature Composable</name>
  <files>
    app/composables/features/useGtaInterviewConsole.ts
  </files>
  <action>
    1. Create `app/composables/features/useGtaInterviewConsole.ts`:
       - Accept `courseId: string | Ref<string | null | undefined>`.
       - Fetch feed via `useFetch` from `/api/me/courses/:courseId/interviews`.
       - Compute derived reactive lists:
         - `activeInterview`: first reservation with `status === 'CHECKED_IN'` (if any).
         - `expectedArrivals`: reservations with `status === 'SCHEDULED'`.
         - `completedList`: reservations with `status === 'COMPLETED' || status === 'CHECKED_OUT' || status === 'MISSED'`.
       - Implement action methods:
         - `checkIn(id: string)`: sends PATCH `{ status: 'CHECKED_IN' }`, displays toast, refreshes feed.
         - `checkOut(id: string, notes?: string)`: sends PATCH `{ status: 'COMPLETED', notes }`, displays toast, refreshes feed.
         - `saveNotes(id: string, notes: string)`: sends PATCH `{ notes }`, displays toast, refreshes feed.
         - `markNoShow(id: string)`: sends PATCH `{ status: 'MISSED' }`, displays toast, refreshes feed.
       - Export loading states (`isUpdating`, `feedStatus`, `refreshFeed`).
  </action>
  <verify>test -f app/composables/features/useGtaInterviewConsole.ts</verify>
  <done>useGtaInterviewConsole exposes reactive categorization of reservations and action methods for check-in, checkout, notes, and no-show marking.</done>
</task>

<task type="auto">
  <name>Unit Tests for GTA Console Endpoints & Composable</name>
  <files>
    test/unit/server/api/gta-interview-console.test.ts,
    test/unit/app/composables/useGtaInterviewConsole.spec.ts
  </files>
  <action>
    1. Create `test/unit/server/api/gta-interview-console.test.ts`:
       - Tests for `GET /api/me/courses/:courseId/interviews`:
         - 401 unauthenticated.
         - 403 non-enrolled user or student role without permissions.
         - 200 returns filtered reservations for the authenticated GTA.
         - 200 returns all course reservations when called by instructor.
       - Tests for `PATCH /api/me/courses/:courseId/interviews/:id`:
         - 403 if caller is not the assigned GTA and not an instructor.
         - 200 checks in student and records `checkedInAt`.
         - 200 completes interview, updates notes, and records `checkedOutAt`.
         - 200 marks student as MISSED (no-show).
    2. Create `test/unit/app/composables/useGtaInterviewConsole.spec.ts`:
       - Tests reactive categorization into active, expected, and completed lists.
       - Tests `checkIn`, `checkOut`, `saveNotes`, and `markNoShow`.
  </action>
  <verify>docker compose exec app-dev pnpm test:unit test/unit/server/api/gta-interview-console.test.ts test/unit/app/composables/useGtaInterviewConsole.spec.ts</verify>
  <done>GTA interview feed endpoints and composable have 100% passing unit tests.</done>
</task>

## Success Criteria

- GTAs and instructors can retrieve real-time course interview feeds.
- Check-in, checkout, note updating, and no-show actions are secured and persist correct timestamps and statuses.
- All unit tests pass with zero regressions.
