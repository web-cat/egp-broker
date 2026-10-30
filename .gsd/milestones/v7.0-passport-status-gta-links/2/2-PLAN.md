---
phase: 2
plan: 2
wave: 2
gap_closure: false
---

# Plan 2.2: Reservation Submission Status Refresh Server APIs

## Objective

Connect the PassPort v1.2 status query client to the GTA interview reservation lifecycle. This implements the backend service to resolve a student's context, identity, and assignment tool, execute the query, and persist the cached status and timestamp on `GtaInterviewReservation`. It exposes REST endpoints (`POST /api/me/courses/:courseId/interviews/:id/refresh-status` and batch `POST /api/me/courses/:courseId/interviews/refresh-status`) with strict course authorization, and verifies projection in interview feeds.

## Context

- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md` (DECISION-019, DECISION-021)
- `server/utils/passport.ts`
- `server/utils/gta-interview.ts`
- `server/api/me/courses/[courseId]/interviews/index.get.ts`
- `test/unit/server/api/gta-interview-console.test.ts`

## Tasks

<task type="auto">
  <name>Implement reservation status refresh service</name>
  <files>
    server/utils/passport.ts
  </files>
  <action>
    1. In `server/utils/passport.ts`:
       - Implement `refreshReservationSubmissionStatus(reservationId: string)`:
         - Query `prisma.gtaInterviewReservation.findUnique` including:
           - `assignment`: `include: { tool: true, course: { include: { deployment: { include: { platform: true } } } } }`
           - `student`: `include: { ltiIdentities: true }`
         - If reservation not found, throw 404 error.
         - Check if `assignment.tool` exists and has `supportsPassport: true`, `passportClientId`, and `passportClientSecret`. If not, update `submissionStatusCheckedAt = new Date()` and return reservation.
         - Resolve LMS platform, deployment, and context ID matching `buildPassPortExtensionPayload` pattern.
         - Resolve student LTI identity (`ltiSub` or fallback to student id) and email/names.
         - Invoke `queryPassPortSubmissionStatus`.
         - Update `prisma.gtaInterviewReservation.update`:
           - `where: { id: reservationId }`
           - `data: { submissionStatus: cachedStatus ? (cachedStatus as unknown as Prisma.InputJsonValue) : Prisma.DbNull, submissionStatusCheckedAt: new Date() }`
           - `include: { assignment: { select: { id: true, title: true } }, student: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } }, gta: { select: { id: true, firstName: true, lastName: true, email: true } } }`
         - Return updated reservation.
       - Implement `refreshBatchReservationSubmissionStatus(reservationIds: string[])`:
         - Map over `reservationIds` with `Promise.allSettled`, executing `refreshReservationSubmissionStatus`.
         - Return updated reservations list.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/server/utils/passport.test.ts`
  </verify>
  <done>
    `refreshReservationSubmissionStatus` successfully queries external tool and updates database record.
  </done>
</task>

<task type="auto">
  <name>Create refresh-status endpoints and automated test suite</name>
  <files>
    server/api/me/courses/[courseId]/interviews/[id]/refresh-status.post.ts
    server/api/me/courses/[courseId]/interviews/refresh-status.post.ts
    test/unit/server/api/gta-interview-refresh-status.test.ts
  </files>
  <action>
    1. Create `server/api/me/courses/[courseId]/interviews/[id]/refresh-status.post.ts`:
       - Validate course membership via `assertCourseMember(event, courseId)` (require GTA or Instructor role).
       - Validate reservation exists and belongs to this course.
       - If user is GTA (not instructor), verify reservation is assigned to them.
       - Call `refreshReservationSubmissionStatus(reservationId)`.
       - Return `{ statusCode: 200, data: updatedReservation }`.
    2. Create `server/api/me/courses/[courseId]/interviews/refresh-status.post.ts`:
       - Validate course membership via `assertCourseMember(event, courseId)`.
       - Read validated body with schema: `z.object({ reservationIds: z.array(z.string().cuid()).min(1).max(20) })`.
       - Verify all requested reservations belong to the course (and assigned to the GTA if not instructor).
       - Call `refreshBatchReservationSubmissionStatus(reservationIds)`.
       - Return `{ statusCode: 200, data: updatedReservations }`.
    3. Create `test/unit/server/api/gta-interview-refresh-status.test.ts`:
       - Test single refresh returns 200 and updated reservation with status and timestamp.
       - Test unauthorized access (student role) throws 403 Forbidden.
       - Test GTA attempting to refresh another GTA's interview throws 403 Forbidden.
       - Test batch refresh updates all provided reservations.
       - Test reservation without PassPort tool gracefully updates `submissionStatusCheckedAt` without error.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/server/api/gta-interview-refresh-status.test.ts`
  </verify>
  <done>
    Single and batch refresh endpoints pass all authorization, validation, and integration tests.
  </done>
</task>

## Must-Haves

After all tasks complete, verify:

- [ ] `refreshReservationSubmissionStatus` accurately resolves LTI identity, queries external tool, and persists status cache.
- [ ] `POST /api/me/courses/:courseId/interviews/:id/refresh-status` enforces course and GTA ownership authorization.
- [ ] `POST /api/me/courses/:courseId/interviews/refresh-status` handles batch refresh for visible dashboard cards.
- [ ] GTA interview feed `GET /api/me/courses/:courseId/interviews` includes `submissionStatus` and `submissionStatusCheckedAt`.
- [ ] All unit tests pass.

## Success Criteria

- [ ] All tasks verified passing.
- [ ] Must-haves confirmed.
- [ ] No regressions across repository tests.
