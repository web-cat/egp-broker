---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Seat-Interval Availability Engine in cbtf.ts

## Objective

Overhaul `generateAvailableSlotsForDate` in `server/utils/cbtf.ts` to replace the 115-minute rolling window filter with true seat-specific interval availability and offset-specific arrival quotas. Update `getRecommendedDaysAndSlots` and `server/api/me/cbtf/availability.get.ts` to pass and respect `assignment.cbtfDurationMinutes`. Verify with unit tests simulating peak staggered loads from `schedule-holes.md` to prove zero phantom capacity lockouts.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [.gsd/DECISIONS.md](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) (DECISION-015 through DECISION-018)
- [schedule-holes.md](file:///Users/edwards/git/egp-broker/schedule-holes.md)
- [schedule-new-design.md](file:///Users/edwards/git/egp-broker/schedule-new-design.md)
- [server/utils/cbtf.ts](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts)
- [server/api/me/cbtf/availability.get.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/availability.get.ts)
- [test/unit/server/utils/cbtf.test.ts](file:///Users/edwards/git/egp-broker/test/unit/server/utils/cbtf.test.ts)

## Tasks

<task type="auto">
  <name>Overhaul generateAvailableSlotsForDate with Seat Interval Availability</name>
  <files>server/utils/cbtf.ts,server/api/me/cbtf/availability.get.ts</files>
  <action>
    In `server/utils/cbtf.ts`:
    1. Update `generateAvailableSlotsForDate`:
       - Accept `durationMinutes: number = 60` and use `stepMs = 5 * 60 * 1000` and `durationMs = durationMinutes * 60 * 1000`.
       - For each candidate slot $[slotStart, slotEnd)$:
         - Compute `offset = Math.floor(slotStart.getUTCMinutes() / 5)`.
         - Compute `maxArrivals = calculateMaxArrivalsPerSlot(facility.totalSeats, offset, durationMinutes, facility.elasticSeatCount ?? 2)`.
         - Enforce arrival throttle: `arrivalsCount < maxArrivals`.
         - Replace rolling window count (`activeReservations.length < facility.totalSeats`) with seat interval testing:
           - Identify active reservations overlapping $[slotStart, slotEnd)$ (`startTime < slotEnd && endTime > slotStart`).
           - Collect `occupiedSeatNumbers = new Set(overlapping.map(r => r.seatNumber))`.
           - Determine phased seats: `phasedSeats = calculatePhasedSeats(facility.totalSeats, facility.elasticSeatCount ?? 2)`.
           - Retrieve `seatAllocationOrder`: if configured, use `seatAllocationOrder.slice(0, phasedSeats)`, otherwise use seats `1..phasedSeats`.
           - A slot has capacity if at least one phased seat in `seatAllocationOrder` is NOT in `occupiedSeatNumbers`.
       - Return `occupiedSeatsCount` as the count of occupied phased seats in that window.
    2. Update `getRecommendedDaysAndSlots`:
       - Accept `durationMinutes: number = 60` and pass it to `generateAvailableSlotsForDate`.
    3. Update `server/api/me/cbtf/availability.get.ts`:
       - Select `cbtfDurationMinutes` on `assignment`.
       - Pass `durationMinutes = assignment.cbtfDurationMinutes ?? 60` to `getRecommendedDaysAndSlots`.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf.test.ts</verify>
  <done>`generateAvailableSlotsForDate` accurately tests seat availability without rolling window phantom inflation.</done>
</task>

<task type="auto">
  <name>Add Unit Tests for Seat-Interval Slot Generation and Staggered Load Simulation</name>
  <files>test/unit/server/utils/cbtf.test.ts</files>
  <action>
    Add test cases to `test/unit/server/utils/cbtf.test.ts`:
    1. Test 30-minute slot generation: produces slots with 30-minute duration and enforces 3-per-offset arrival throttle.
    2. Test seat-interval availability:
       - Scenario simulating the Thursday afternoon failure in `schedule-holes.md`:
         - 14 arrivals from 1:00-2:00 PM, 18 arrivals from 2:00-3:00 PM on phased seats.
         - Verify that an unreserved arrival time (e.g., :00 with free primary seat) remains OPEN even though total overlapping reservations across the 2-hour window exceeds 20.
       - Verify that a slot is marked CLOSED only when its arrival quota is reached OR all phased seats are truly occupied.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf.test.ts</verify>
  <done>All tests in `test/unit/server/utils/cbtf.test.ts` pass, proving 0 phantom capacity dropouts.</done>
</task>

## Success Criteria

- [ ] `generateAvailableSlotsForDate` supports 30m and 60m durations.
- [ ] Phantom 115-minute concurrency bug is eliminated; slot availability reflects true physical seat availability.
- [ ] `availability.get.ts` passes assignment CBTF duration to slot generator.
- [ ] Staggered peak load test passes with 0 false capacity lockouts.
