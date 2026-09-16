# Plan 2.2 Summary: Student Reservation Booking API & Pass Redemption Gating

## Delivered Work

1. **Student Reservation Booking, Status & Cancellation Endpoints**:
   - `GET /api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/my`:
     - Returns caller's active reservation (`SCHEDULED` or `CHECKED_IN`) or most recent reservation.
     - Includes assigned GTA profile (`id`, `firstName`, `lastName`, `email`) and course `interviewLocation`.
   - `POST /api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations`:
     - Validates payload with `createGtaInterviewReservationInputSchema`.
     - Ensures assignment has `hasInterviews = true`.
     - Validates slot falls within assignment's `interviewWindowStart` and `interviewWindowEnd` if configured.
     - Prevents duplicate active bookings for the student on the same assignment.
     - Automatically selects and assigns an on-duty, unbooked GTA for the 10-minute slot.
     - Sets 5-minute appointment duration (`endTime = startTime + 5m`).
     - Returns 201 with reservation details, assigned GTA, and course interview location.
   - `DELETE /api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/[id]`:
     - Allows student (or course instructor) to cancel an active `SCHEDULED` reservation.
     - Updates status to `CANCELLED`, freeing GTA capacity for other students or rescheduling.

2. **Resubmission Pass Redemption Gating**:
   - Updated `server/utils/redemptions.ts`:
     - When an assignment has `hasInterviews = true` and the pass is a resubmission pass (`!pool.passType.extensionOnly`), checks `gtaInterviewReservation` for a reservation with status in `['COMPLETED', 'CHECKED_OUT']`.
     - If no completed interview exists, halts redemption with a descriptive 400 error requiring interview completion.
     - Extension-only passes remain exempt from interview completion requirements.

3. **Vitest Unit Test Suites**:
   - `test/unit/server/api/gta-reservations.test.ts`: 6/6 tests passing (booking with auto-assigned GTA, slot conflicts/exhaustion, duplicate booking prevention, window enforcement, cancellation, and rebooking).
   - `test/unit/server/utils/gta-pass-gating.test.ts`: 5/5 tests passing (gating resubmission passes without interview, permitting resubmission after `COMPLETED` or `CHECKED_OUT`, permitting extension passes, and ignoring assignments without interviews).

## Verification

- `docker compose exec app-dev pnpm test:unit test/unit/server/utils/gta-pass-gating.test.ts test/unit/server/api/gta-reservations.test.ts`: Passed (11/11 tests).
- Full Vitest suite: 126 test files passed, 694/694 tests passed.
- Targeted ESLint: Clean (0 errors, 0 warnings).
