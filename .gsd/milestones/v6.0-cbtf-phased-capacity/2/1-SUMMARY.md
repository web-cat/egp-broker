# Plan 2.1 Summary: Seat-Interval Availability Engine in cbtf.ts

> **Executed:** 2026-10-09
> **Status:** ✅ Complete
> **Coverage:** 100% Behavioral Coverage, All 44 tests passing in `cbtf.test.ts`

---

## 🎯 Deliverables Accomplished

1. **Elimination of Phantom Concurrency Trap (`server/utils/cbtf.ts`)**:
   - Overhauled `generateAvailableSlotsForDate` to evaluate true physical seat interval availability instead of rolling 115-minute union counts.
   - For any candidate slot $[slotStart, slotEnd)$, tests whether at least one phased seat in the facility is free across the entire window.
   - Slices candidate capacity to `phasedSeats` (`calculatePhasedSeats(totalSeats, elasticSeatCount)`), preserving elastic hot spares (Seats 19 & 20).
2. **Dual Duration Support (30m & 60m)**:
   - Added `durationMinutes` parameter to `generateAvailableSlotsForDate` and `getRecommendedDaysAndSlots`.
   - 30-minute mode produces 30-minute intervals and enforces 3-per-offset arrival throttles.
   - 60-minute mode enforces alternating 2–1 arrival throttles.
3. **Availability Endpoint Integration (`server/api/me/cbtf/availability.get.ts`)**:
   - Queries `cbtfDurationMinutes` from `Assignment` (defaulting to 60).
   - Passes duration to `getRecommendedDaysAndSlots` and returns `cbtfDurationMinutes` in response payload.
4. **Empirical Proof & Peak Load Verification (`test/unit/server/utils/cbtf.test.ts`)**:
   - Verified 30-minute slot generation and boundary constraints.
   - Simulated the peak staggered afternoon load from `schedule-holes.md` (28 overlapping reservations across a 2-hour window in a 20-seat facility): verified that unreserved arrival slots with open physical workstations remain OPEN (0 false capacity dropouts).
