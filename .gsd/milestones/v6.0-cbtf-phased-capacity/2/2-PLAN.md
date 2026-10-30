---
phase: 2
plan: 2
wave: 2
---

# Plan 2.2: Reservation Booking Endpoints & High-Throughput Verification

## Objective

Update student booking (`reservations.post.ts`) and rescheduling (`[id].patch.ts`) endpoints to support assignment-specific CBTF durations (30m vs. 60m), enforce offset-specific arrival quotas, and allocate seats strictly within primary phased channels while reserving elastic hot spares. Add comprehensive endpoint tests and high-concurrency validation.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [.gsd/DECISIONS.md](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md)
- [server/api/me/cbtf/reservations.post.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/reservations.post.ts)
- [server/api/me/cbtf/reservations/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/reservations/[id].patch.ts)
- [test/unit/server/api/me/cbtf-reservations.test.ts](file:///Users/edwards/git/egp-broker/test/unit/server/api/me/cbtf-reservations.test.ts)

## Tasks

<task type="auto">
  <name>Update Reservation POST and PATCH Endpoints for Phased Allocation and Duration</name>
  <files>server/api/me/cbtf/reservations.post.ts,server/api/me/cbtf/reservations/[id].patch.ts</files>
  <action>
    In `server/api/me/cbtf/reservations.post.ts`:
    1. Select `cbtfDurationMinutes` on assignment query.
    2. Compute `durationMinutes = assignment.cbtfDurationMinutes ?? 60`.
    3. Calculate `endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)`.
    4. In transactional booking:
       - Compute `offset = Math.floor(startTime.getUTCMinutes() / 5)`.
       - Compute `maxArrivals = calculateMaxArrivalsPerSlot(facility.totalSeats, offset, durationMinutes, facility.elasticSeatCount ?? 2)`.
       - Enforce throttle: `concurrentArrivals >= maxArrivals`.
       - Test room capacity against phased seats: query active reservations overlapping $[startTime, endTime)$ and verify at least one phased seat in `seatOrder` is free.
       - Call `assignNextSeat(seatOrder, startTime, endTime, activeReservations, null, durationMinutes, facility.elasticSeatCount ?? 2)`.

    In `server/api/me/cbtf/reservations/[id].patch.ts`:
    1. Include assignment `cbtfDurationMinutes` when loading existing reservation.
    2. Compute `durationMinutes = existingReservation.assignment?.cbtfDurationMinutes ?? 60`.
    3. Calculate `newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)`.
    4. Apply matching offset throttle and phased seat allocation logic in rescheduling transaction.

  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/api/me/cbtf-reservations.test.ts</verify>
  <done>Booking and rescheduling endpoints correctly handle 30m/60m durations and offset quotas.</done>
</task>

<task type="auto">
  <name>Add Unit & High-Throughput Verification Tests for Booking Endpoints</name>
  <files>test/unit/server/api/me/cbtf-reservations.test.ts</files>
  <action>
    In `test/unit/server/api/me/cbtf-reservations.test.ts`:
    1. Test 30-minute assignment booking: verify created reservation has `endTime` equal to `startTime + 30 minutes`.
    2. Test offset quota enforcement:
       - For a 1-seat offset (e.g. :05 in 60m mode), verify 1 arrival succeeds and 2nd arrival at same time is rejected with 409.
       - For a 2-seat offset (e.g. :00 in 60m mode), verify 2 arrivals succeed and 3rd is rejected.
    3. Test rescheduling with duration preservation: verify rescheduled reservation respects assignment duration.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/api/me/cbtf-reservations.test.ts</verify>
  <done>All reservation endpoint tests pass with 100% coverage.</done>
</task>

## Success Criteria

- [ ] POST and PATCH endpoints calculate `endTime` dynamically from `assignment.cbtfDurationMinutes`.
- [ ] Offset quotas strictly prevent more arrivals than the offset's assigned seats.
- [ ] All tests in `test/unit/server/api/me/cbtf-reservations.test.ts` pass cleanly.
