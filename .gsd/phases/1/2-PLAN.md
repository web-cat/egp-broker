---
phase: 1
plan: 2
wave: 2
---

# Plan 1.2: Core Allocation Mathematics & Behavioral Unit Tests

## Objective

Implement the periodic phased seat allocation mathematics in `server/utils/cbtf.ts`. Support both 60-minute duration (18 phased seats in an alternating 2–1 pattern across 12 arrival offsets) and 30-minute duration (18 phased seats in 3-per-offset distribution across 6 offsets). Strictly bound arrival throttles to offset seat quotas and protect the 2 elastic pool seats from automated booking. Verify with 100% Vitest unit test coverage.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [.gsd/DECISIONS.md](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) (DECISION-015, DECISION-016, DECISION-017)
- [schedule-new-design.md](file:///Users/edwards/git/egp-broker/schedule-new-design.md)
- [server/utils/cbtf.ts](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts)
- [test/unit/server/utils/cbtf.test.ts](file:///Users/edwards/git/egp-broker/test/unit/server/utils/cbtf.test.ts)

## Tasks

<task type="auto">
  <name>Implement Phased Seat Partitioning and Offset Quota Functions in cbtf.ts</name>
  <files>server/utils/cbtf.ts</files>
  <action>
    In `server/utils/cbtf.ts`:
    1. Implement `calculatePhasedSeats(totalSeats: number, elasticSeatCount: number = 2): number`
       - Returns `Math.max(0, totalSeats - elasticSeatCount)`.
    2. Implement `getMaxArrivalsForOffset(phasedSeatsCount: number, offset: number, durationMinutes: number = 60): number`
       - For 60-minute mode: partition across 12 offsets (0..11). Distribute remainders evenly using alternating pattern (offsets 0, 2, 4, 6, 8, 10 receive base + 1 if remainder >= 6). For 18 seats, offsets 0, 2, 4, 6, 8, 10 return 2, and 1, 3, 5, 7, 9, 11 return 1.
       - For 30-minute mode: partition across 6 offsets (0..5, using `offset % 6`). For 18 seats, returns 3 for every offset.
    3. Update `getOffsetSeatIndices(phasedSeatsCount: number, offset: number, durationMinutes: number = 60)`
       - Returns `{ startIndex, count }` within `seatAllocationOrder.slice(0, phasedSeatsCount)`.
       - For 60-minute mode: returns slice corresponding to the alternating 2-1 partition.
       - For 30-minute mode: returns slice corresponding to the 3-seat block for `offset % 6`.
    4. Update `calculateMaxArrivalsPerSlot` to accept `(facility: { totalSeats: number; elasticSeatCount?: number }, offset: number, durationMinutes?: number)` while maintaining backwards compatibility if called with only `totalSeats`.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf.test.ts</verify>
  <done>Allocation math functions correctly compute 18/2 seat partitioning and offset quotas for both 30m and 60m tiers.</done>
</task>

<task type="auto">
  <name>Add Comprehensive Vitest Unit Tests for Allocation Mathematics</name>
  <files>test/unit/server/utils/cbtf.test.ts</files>
  <action>
    Add dedicated test suites to `test/unit/server/utils/cbtf.test.ts`:
    1. `calculatePhasedSeats`:
       - Tests 20 total seats with 2 elastic seats -> 18 phased seats.
       - Tests custom elastic seat counts and boundary values (0 elastic seats, edge cases).
    2. `getMaxArrivalsForOffset`:
       - 60-minute duration with 18 seats: verify alternating 2-1 pattern across all 12 offsets (:00=2, :05=1, :10=2, :15=1, :20=2, :25=1, :30=2, :35=1, :40=2, :45=1, :50=2, :55=1). Sum equals exactly 18.
       - 30-minute duration with 18 seats: verify exactly 3 arrivals for every 5-minute offset (:00..:55). Sum across 30 minutes equals exactly 18; sum across 1 hour equals 36.
    3. `getOffsetSeatIndices`:
       - Verify start index and count for both 60m alternating and 30m 3-seat modes.
       - Verify that slices never exceed `phasedSeatsCount` (protecting elastic seats 19 and 20).
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf.test.ts</verify>
  <done>All new allocation unit tests pass with 100% coverage and zero regression in existing tests.</done>
</task>

## Success Criteria

- [ ] `calculatePhasedSeats` accurately computes phased capacity subtracting elastic reserve.
- [ ] `getMaxArrivalsForOffset` returns exact alternating 2-1 quotas for 60m and 3-per-offset quotas for 30m.
- [ ] `getOffsetSeatIndices` partitions seat order cleanly and protects elastic hot spares.
- [ ] All unit tests in `test/unit/server/utils/cbtf.test.ts` pass cleanly.
