---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: High-Throughput Concurrency Simulation & Hot-Spare Failover

## Objective

Deliver rigorous end-to-end verification of the Periodic Phased Seat Allocation engine. Implement proctor hot-spare seat reassignment to support emergency workstation failovers (e.g., swapping a student to hot-spare Seat 19 or 20 when lab hardware crashes), and build a high-throughput multi-hour simulation test suite in `test/unit/server/utils/cbtf-simulation.test.ts` proving zero phantom capacity dropouts across consecutive 60-minute and 30-minute cycles (REQ-611).

## Context

- `.gsd/SPEC.md`
- `.gsd/ROADMAP.md`
- `schedule-new-design.md`
- `server/utils/cbtf.ts`
- `server/api/proctor/`
- `server/api/admin/cbtf/reservations/[id].patch.ts`

## Tasks

<task type="auto">
  <name>Implement proctor hot-spare seat reassignment endpoint and utility</name>
  <files>
    server/utils/cbtf.ts
    server/api/proctor/reassign-seat.post.ts
    shared/schemas/cbtf.schema.ts
    test/unit/server/api/proctor/reassign-seat.test.ts
  </files>
  <action>
    1. In `shared/schemas/cbtf.schema.ts`, define `cbtfProctorReassignSeatSchema` validating `{ reservationId: z.string().cuid2().or(z.string().min(1)), targetSeatNumber: z.number().int().min(1) }`.
    2. In `server/utils/cbtf.ts`, create `reassignReservationSeat(prisma, reservationId, targetSeatNumber, modifiedByUserId)`:
       - Fetch the reservation (including assignment and user details).
       - Validate reservation status is `SCHEDULED` or `CHECKED_IN` (cannot reassign completed, cancelled, or missed sessions).
       - Query active reservations overlapping the same time window `[startTime, endTime)` on `targetSeatNumber` excluding `reservationId`.
       - If target seat is occupied during that window, throw a 409 Conflict error.
       - Update the reservation's `seatNumber` to `targetSeatNumber`.
       - If reservation is `SCHEDULED`, invoke `syncCbtfReservationCanvasOverride` so Canvas IP/time constraints match the updated workstation.
       - Return formatted `CbtfReservationDto`.
    3. Create `server/api/proctor/reassign-seat.post.ts`:
       - Verify caller has `globalRole === 'PROCTOR'` or `'ADMIN'`.
       - Validate body with `cbtfProctorReassignSeatSchema`.
       - Call `reassignReservationSeat` and return `{ statusCode: 200, data }`.
    4. Write comprehensive unit tests in `test/unit/server/api/proctor/reassign-seat.test.ts` verifying authentication guards, state validation, collision detection, and successful hot-spare reassignment to Seat 19 and 20.
  </action>
  <verify>
    docker compose exec app-dev pnpm vitest run test/unit/server/api/proctor/reassign-seat.test.ts
  </verify>
  <done>
    Proctors and admins can reassign students whose hardware crashed to hot-spare seats with conflict prevention and Canvas override sync, verified by passing unit tests.
  </done>
</task>

<task type="auto">
  <name>Build high-throughput concurrency stress simulation test suite (REQ-611)</name>
  <files>
    test/unit/server/utils/cbtf-simulation.test.ts
  </files>
  <action>
    Create `test/unit/server/utils/cbtf-simulation.test.ts` to simulate high-density operations in a 20-seat facility (18 phased seats, 2 elastic hot spares):
    1. **60-Minute Max Load Simulation**:
       - Simulate Hour 1 (08:00–09:00): generate available slots and book 18 students matching the 2–1 alternating quota across all 12 offsets (:00 through :55). Verify all 18 primary channels are cleanly allocated without collisions.
       - Simulate Hour 2 (09:00–10:00) back-to-back: generate available slots and book 18 incoming students. Verify 0 phantom capacity dropouts—each slot opens as expected at the 1-hour boundary when the prior student's block finishes, yielding 100% planned utilization (36 students across 2 hours).
    2. **30-Minute Max Load Simulation**:
       - Simulate two back-to-back half-hour blocks (08:00–08:30 and 08:30–09:00) with 18 arrivals per 30 minutes (3 per 5-minute offset).
       - Verify slot generator yields slots for all 6 offsets per cycle and books exactly 36 students in 1 hour with 0 holes or dropouts.
    3. **Emergency Hot-Spare Workstation Failover Integration**:
       - While 18 students are seated in Hour 1, workstation #4 suffers a simulated hardware failure.
       - Proctor reassigns the student from Seat 4 to hot-spare Seat 19.
       - Verify automated booking never assigned Seat 19 or 20.
       - Verify Seat 4 becomes immediately available for subsequent slots once freed.
       - Verify check-in and check-out flows complete cleanly for students on both phased and hot-spare workstations.
  </action>
  <verify>
    docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf-simulation.test.ts
  </verify>
  <done>
    Simulation passes with 100% green tests proving 0 phantom capacity dropouts, strict quota enforcement, and clean emergency hot-spare failover.
  </done>
</task>

## Success Criteria

- [ ] `reassignReservationSeat` prevents collisions and reassigns workstations cleanly.
- [ ] POST `/api/proctor/reassign-seat` allows proctors and admins to reassign seats to hot spares (Seats 19 & 20).
- [ ] High-throughput simulation passes for 60-minute and 30-minute exam cohorts with 0 phantom capacity lockouts (REQ-611).
- [ ] All new tests pass inside Docker container.
