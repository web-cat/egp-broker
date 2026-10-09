# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Project**: CBTF Phased Capacity & Duration Engine
> **Milestone**: v6.0 — CBTF Phased Capacity & Duration Engine

## Vision

Overhaul the CBTF scheduling engine to replace the flawed 115-minute rolling-window concurrency filter with a high-throughput **Periodic Phased Seat Allocation** architecture. By partitioning facility seats into 18 phased seats and a 2-seat elastic pool (with an alternating 2–1 arrival quota per 5-minute offset), the facility eliminates "schedule holes" and phantom capacity lockouts. The system supports both 30-minute reservation blocks (for $\le 25$-minute quizzes) and 60-minute blocks (for $\le 50$-minute exams), providing built-in transition buffers, smooth proctor check-in rates ($\le 2$ arrivals/5 min for 60m; $\le 3$ arrivals/5 min for 30m), and doubling daily throughput for quiz cohorts up to 280 students/day.

## Goals

1. **Phased Seat Partitioning & Quota-Matched Arrival Throttles**:
   - Partition facility seats into **18 phased seats** and **2 elastic pool seats** (for a 20-seat lab).
   - In 60-minute mode, distribute the 18 seats across the 12 five-minute arrival offsets (:00 through :55) in a balanced 2–1 alternating pattern.
   - Enforce offset-specific arrival quotas matching seat allocations (preventing cross-offset seat stealing).
2. **Dual Duration Support (30-Minute and 60-Minute Tiers)**:
   - Support assignment-level reservation duration configuration: 30 minutes or 60 minutes.
   - Enforce business invariants for student test time: at most 25 minutes for 30-minute slots ($\ge 5$ min buffer) and at most 50 minutes for 60-minute slots ($\ge 10$ min buffer).
   - In 30-minute mode, cycle 18 phased seats twice per hour with 3 seats per 5-minute offset across the 6 half-hour offsets (:00, :05, :10, :15, :20, :25, and repeated :30..:55).
3. **Elimination of Phantom Concurrency & Schedule Holes**:
   - Replace the rolling 115-minute `activeReservations.length < totalSeats` window filter with true seat-specific interval availability (`isSeatFreeInWindow`).
   - Eliminate circular fallback cannibalization so primary channels remain orthogonal and contiguous.
4. **Elastic Pool Reservation & Hot Spares**:
   - Preserve Seats 19 and 20 as hot spares for hardware failure failover and proctor emergency reassignments.
5. **Teacher Configuration & Student Scheduling UI**:
   - Allow teachers to set CBTF exam duration (30 min vs 60 min) per assignment.
   - Render student scheduling slots at the assignment's configured duration intervals.

## Non-Goals (Out of Scope)

- Handling extra-time accommodations inside the CBTF (disability services operates a separate dedicated testing center).
- Dynamic arbitrary non-standard durations (e.g., 47 minutes or 75 minutes); assignments are classified as either 30-minute or 60-minute tiers.
- Physical room floor-plan reconfiguration.

## Users

- **Students**: Experience abundant, hole-free appointment slots with clear 30-minute or 60-minute reservation windows.
- **Instructors**: Configure assignment test duration (30m quiz or 60m exam) with confidence that cohort capacity matches student numbers.
- **Proctors**: Experience smooth, predictable check-in pacing ($\le 2$ or $\le 3$ arrivals every 5 minutes) and have 2 hot-spare workstations available for emergency swaps.

## Constraints

- **Strict Nuxt 4 Architecture**: Layered sovereignty, pure presenter base components, feature-specific composables, Zod validation.
- **Timezone Sovereignty**: UTC database storage; `America/New_York` offset math.
- **Docker Parity**: All tests and commands run via `docker compose exec app-dev`.
- **Zero Regressions**: Maintain 100% test pass rate across all test suites.

## Success Criteria

- [ ] 18 phased seats and 2 elastic pool seats correctly partitioned in `cbtf.ts`.
- [ ] Arrival quotas strictly enforced per offset (no slot accepts more arrivals than its assigned seats).
- [ ] 30-minute and 60-minute reservation durations supported end-to-end.
- [ ] Phantom capacity lockup completely resolved: slots remain available whenever assigned seats are unreserved.
- [ ] 100% Vitest unit test coverage for new allocation logic, slot generation, and booking endpoints.
