---
phase: 2
plan: 2
wave: 2
---

# Plan 2.2: Student Reservation Booking API & Pass Redemption Gating

## Objective

Implement the student interview booking, retrieval, and cancellation endpoints with automatic GTA assignment, and integrate pass redemption gating in `server/utils/redemptions.ts` to block resubmission passes until a grading interview is completed.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-505, REQ-506, REQ-509)
- `server/utils/redemptions.ts`
- `prisma/schema.prisma` (`GtaInterviewReservation`, `GtaShift`, `PassType`, `PassRedemption`)

## Tasks

<task type="auto">
  <name>Implement Student Reservation Booking, Status & Cancellation Endpoints</name>
  <files>
    server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/index.post.ts,
    server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/my.get.ts,
    server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/[id].delete.ts
  </files>
  <action>
    Create the student interview reservation endpoints:
    1. `my.get.ts`:
       - Authenticate user via `getUserSession(event)`.
       - Retrieve the caller's active reservation (`status IN ['SCHEDULED', 'CHECKED_IN']`) or most recent reservation for this assignment.
       - Include `gta` details (`firstName`, `lastName`, `email`) and course `interviewLocation`.
       - Return `{ statusCode: 200, data: reservation | null }`.
    2. `index.post.ts`:
       - Validate body with `createGtaInterviewReservationInputSchema` (`startTime`).
       - Validate course membership.
       - Verify assignment has `hasInterviews === true`.
       - Verify `startTime` falls within `[interviewWindowStart, interviewWindowEnd]` (if configured).
       - Verify student does not already have an active scheduled reservation (`status: SCHEDULED`) for this assignment.
       - Find all on-duty GTAs for this slot time from `GtaShift`.
       - Find active reservations for this slot time to identify already-booked GTAs.
       - Filter to find unbooked GTAs; if none, throw 409 Conflict ("This slot is no longer available").
       - Pick an available GTA (first available).
       - Compute `endTime = new Date(start.getTime() + 5 * 60 * 1000)`.
       - Create `GtaInterviewReservation` with `{ assignmentId, studentId: user.id, gtaId, startTime, endTime, status: 'SCHEDULED' }`.
       - Return `{ statusCode: 201, data: reservation }` with assigned GTA and course interview location.
    3. `[id].delete.ts`:
       - Find reservation by `id`. Verify ownership (`studentId === user.id` or instructor).
       - Verify reservation status is `SCHEDULED`.
       - Update status to `CANCELLED`.
       - Return `{ statusCode: 200, data: { success: true } }`.
  </action>
  <verify>test -f server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/index.post.ts</verify>
  <done>Student booking assigns an available GTA, confirms with GTA details, enforces single active appointment, and supports cancellation.</done>
</task>

<task type="auto">
  <name>Gate Resubmission Pass Redemptions on Completed Interview</name>
  <files>server/utils/redemptions.ts</files>
  <action>
    Update `server/utils/redemptions.ts` in `createPassRedemption`:
    1. Check if the assignment incorporates grading interviews: `assignment.hasInterviews === true`.
    2. Check if the pass type is a resubmission pass (i.e. `!pool.passType.extensionOnly`).
    3. If both conditions are true:
       - Query `tx.gtaInterviewReservation.findFirst({ where: { assignmentId, studentId: userId, status: { in: ['COMPLETED', 'CHECKED_OUT'] } } })`.
       - If no completed or checked-out interview exists:
         throw `createError({ statusCode: 400, statusMessage: 'This assignment requires a completed grading interview with a Graduate TA before redeeming a resubmission pass. Please schedule and complete your interview first.' })`.
    4. Note: Extension passes (`pool.passType.extensionOnly === true`) are NOT gated by this check.
  </action>
  <verify>grep -q "hasInterviews" server/utils/redemptions.ts</verify>
  <done>Non-extension resubmission passes cannot be redeemed on interview assignments without a completed/checked-out interview reservation.</done>
</task>

<task type="auto">
  <name>Unit Tests for Reservations & Pass Redemption Gating</name>
  <files>
    test/unit/server/api/gta-reservations.test.ts,
    test/unit/server/utils/gta-pass-gating.test.ts
  </files>
  <action>
    Create comprehensive Vitest unit tests:
    1. `test/unit/server/api/gta-reservations.test.ts`:
       - Student books slot: assigns available GTA and sets 5-minute duration.
       - Slot conflict: throws 409 if all GTAs for that slot are booked.
       - Double booking: throws 400 if student already has an active `SCHEDULED` reservation for this assignment.
       - Window violation: throws 400 if requested slot is outside `interviewWindowStart` or `interviewWindowEnd`.
       - Cancellation: student cancels reservation; status becomes `CANCELLED`.
       - Rescheduling: after cancelling (or after completing), student can book a new slot.
    2. `test/unit/server/utils/gta-pass-gating.test.ts`:
       - Allows extension pass redemption even if interview is not completed.
       - Rejects resubmission pass redemption when `hasInterviews = true` and no completed interview exists.
       - Allows resubmission pass redemption when `hasInterviews = true` and student has an interview with status `COMPLETED` or `CHECKED_OUT`.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/server/api/gta-reservations.test.ts test/unit/server/utils/gta-pass-gating.test.ts</verify>
  <done>All reservation and pass gating unit tests pass with 100% behavioral coverage.</done>
</task>

## Success Criteria

- [ ] Students can book 10-minute slots, are assigned an available GTA, and receive confirmation.
- [ ] Students cannot have more than 1 active scheduled interview for an assignment at a time.
- [ ] Cancelled or missed interviews allow the student to reschedule.
- [ ] Pass redemptions for resubmission passes are gated on interview completion.
- [ ] Unit tests pass with 100% coverage inside Docker.
