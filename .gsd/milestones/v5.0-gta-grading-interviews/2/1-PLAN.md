---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: 10-Minute Slot Generation & Overlapping GTA Capacity Engine

## Objective

Build the server-side slot availability and capacity engine for Graduate TA interviews. The engine breaks GTA shifts into 10-minute intervals (5-minute interview + 5-minute prep), computes overlapping capacity across all on-duty GTAs, subtracts existing reservations, groups slots into Morning and Afternoon half-day blocks (divided at 12:30 PM), respects the assignment's interview window, and exposes `GET /api/me/courses/:courseId/assignments/:assignmentId/interview-slots`.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-504)
- `server/utils/cbtf.ts` (reference for half-day block structure and time calculations)
- `prisma/schema.prisma` (`GtaShift`, `GtaInterviewReservation`, `Assignment`, `Course`)

## Tasks

<task type="auto">
  <name>Implement GTA Interview Slot & Capacity Engine Utility</name>
  <files>server/utils/gta-slots.ts</files>
  <action>
    Create `server/utils/gta-slots.ts` with:
    1. Constants:
       - `INTERVIEW_SLOT_INTERVAL_MINUTES = 10`
       - `INTERVIEW_DURATION_MINUTES = 5`
       - `GTA_AFTERNOON_DIVIDING_TIME = '12:30'`
    2. Interface definitions:
       - `GtaSlot`: `{ startTime: string (ISO), endTime: string (ISO), time24: string ("HH:mm"), label: string ("10:00 AM – 10:05 AM"), availableGtaCount: number, totalGtaCount: number }`
       - `GtaHalfDayBlock`: `{ date: string ("YYYY-MM-DD"), dayOfWeek: number, dayName: string, blockType: 'MORNING' | 'AFTERNOON', blockLabel: string, slots: GtaSlot[] }`
    3. `calculateGtaSlotsForShifts(shifts: GtaShift[], existingReservations: GtaInterviewReservation[], windowStart?: Date | null, windowEnd?: Date | null, now?: Date)`:
       - For each shift, slice from `startTime` to `endTime` in 10-minute increments.
       - A slot starting at minute $M$ is valid if $M + \text{INTERVIEW\_DURATION\_MINUTES} \le \text{shiftEndMinutes}$.
       - Aggregate slots matching the same UTC calendar date and time.
       - For each distinct slot timestamp:
         - `totalGtaCount` = count of GTAs scheduled on duty.
         - Active reservations = count of non-cancelled/non-missed reservations for that slot timestamp.
         - `availableGtaCount` = `totalGtaCount - activeReservations`.
         - Only include slots where `availableGtaCount > 0` and the slot start is after `now`.
       - Filter slots to fall within `[windowStart, windowEnd]` if defined.
       - Group into half-day blocks:
         - `MORNING`: slots starting before `12:30`.
         - `AFTERNOON`: slots starting at `12:30` or later.
       - Only return blocks that have at least 1 available slot.
  </action>
  <verify>test -f server/utils/gta-slots.ts</verify>
  <done>Slot and capacity calculation accurately handles 10-minute cadence, 5-minute duration, overlapping GTAs, existing reservations, and half-day grouping.</done>
</task>

<task type="auto">
  <name>Implement Course Assignment Interview Slots Endpoint</name>
  <files>server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts</files>
  <action>
    Create `server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts`:
    1. Read `courseId` and `assignmentId` from router params.
    2. Call `assertCourseMember(event, courseId)`.
    3. Fetch assignment: verify it exists in `courseId` and `hasInterviews === true`. If `hasInterviews === false`, throw 400 Bad Request ("This assignment does not require grading interviews").
    4. Fetch all upcoming `GtaShift` records for `courseId` where `date >= today`.
    5. Fetch all active `GtaInterviewReservation` records for `assignmentId` (or course) where `startTime >= now` and `status NOT IN ['CANCELLED', 'MISSED']`.
    6. Call `calculateGtaSlotsForShifts` with the shifts, reservations, assignment's `interviewWindowStart` and `interviewWindowEnd`, and current time.
    7. Fetch `Course.interviewLocation`.
    8. Return `{ statusCode: 200, data: { interviewLocation, blocks } }`.
  </action>
  <verify>test -f server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts</verify>
  <done>Endpoint returns available slots and half-day blocks for valid interview assignments.</done>
</task>

<task type="auto">
  <name>Unit Tests for Slot Generation & Capacity Calculation</name>
  <files>test/unit/server/utils/gta-slots.test.ts</files>
  <action>
    Create `test/unit/server/utils/gta-slots.test.ts` testing:
    1. 10-minute cadence generation for a 1-hour shift (10:00 to 11:00 produces 6 slots: 10:00, 10:10, 10:20, 10:30, 10:40, 10:50).
    2. Overlapping shifts: GTA A (10:00-11:00) and GTA B (10:00-12:00) produce capacity of 2 for 10:00-10:50 and capacity of 1 for 11:00-11:50.
    3. Capacity subtraction: an existing reservation at 10:10 with GTA A reduces available capacity at 10:10 from 2 to 1; when both GTAs are booked at 10:20, available capacity is 0 and slot is excluded.
    4. Half-day block separation: slots before 12:30 PM categorized into MORNING; slots at 12:30 PM or after into AFTERNOON.
    5. Window filtering: slots outside `[interviewWindowStart, interviewWindowEnd]` are excluded.
    6. Empty blocks exclusion: blocks with 0 available slots are omitted from the result.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/server/utils/gta-slots.test.ts</verify>
  <done>Vitest suite for gta-slots passes with 100% test coverage across all boundary and overlapping cases.</done>
</task>

## Success Criteria

- [ ] `server/utils/gta-slots.ts` accurately computes 10-minute slots and capacity.
- [ ] Overlapping GTA shifts sum capacity properly.
- [ ] Reservations reduce net capacity and fully-booked slots disappear.
- [ ] Endpoint `GET .../interview-slots` returns course interview location and filtered half-day blocks.
- [ ] Vitest unit tests pass 100%.
