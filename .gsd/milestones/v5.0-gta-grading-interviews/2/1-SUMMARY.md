# Plan 2.1 Summary: 10-Minute Slot Generation & Overlapping GTA Capacity Engine

## Delivered Work

1. **GTA Slot & Capacity Calculation Engine (`server/utils/gta-slots.ts`)**:
   - `calculateGtaSlotsForShifts`: generates 10-minute interview slots (5-minute student meeting + 5-minute prep).
   - Accurately computes total on-duty GTA capacity from overlapping shifts.
   - Subtracts active reservations (`SCHEDULED`, `CHECKED_IN`, `CHECKED_OUT`, `COMPLETED`), ignoring `CANCELLED` and `MISSED`.
   - Filters out past slots and enforces assignment interview windows (`interviewWindowStart` and `interviewWindowEnd`).
   - Groups available slots into `MORNING` (< 12:30) and `AFTERNOON` (>= 12:30) half-day blocks.
   - Omits empty blocks with zero available capacity.
2. **Assignment Interview Slots Endpoint**:
   - `GET /api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts`: returns course `interviewLocation` and available half-day blocks for assignments with `hasInterviews = true`.
3. **Comprehensive Unit Tests**:
   - `test/unit/server/utils/gta-slots.test.ts` with 6/6 tests passing across 10-minute cadence, overlapping GTAs, capacity subtraction, half-day dividing line, window filtering, and past slot exclusion.
   - ESLint verified clean with 0 warnings.

## Verification

- `docker compose exec app-dev pnpm run test:unit test/unit/server/utils/gta-slots.test.ts`: Passed (6/6 tests passed).
- `docker compose exec app-dev pnpm eslint server/utils/gta-slots.ts server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts test/unit/server/utils/gta-slots.test.ts`: Clean (0 errors, 0 warnings).
