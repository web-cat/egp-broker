# ROADMAP.md

> **Current Phase**: Phase 1: Domain Modeling & Allocation Mathematics
> **Milestone**: v6.0 — CBTF Phased Capacity & Duration Engine
> **Goal**: Replace the 115-minute rolling window capacity filter with Periodic Phased Seat Allocation, supporting 18 phased seats and a 2-seat elastic pool, 30-minute and 60-minute reservation tiers, offset-specific arrival throttling, and true seat-level interval availability.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)
- ✅ **v4.0 — Proctor Training Mode** (Completed 2026-09-11) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v4.0-proctor-training-mode-SUMMARY.md)
- ✅ **v5.0 — Graduate TA Grading Interviews** (Completed 2026-09-16) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v5.0-gta-grading-interviews-SUMMARY.md)

---

## Must-Haves (Milestone v6.0)

- [ ] Database support for assignment CBTF reservation duration (`Assignment.cbtfDurationMinutes`, default 60) and facility elastic reserve (`CbtfFacility.elasticSeatCount`, default 2)
- [ ] Phased seat partitioning algorithm supporting 18 phased seats with alternating 2–1 distribution (60m) and 3-per-offset distribution (30m)
- [ ] Offset-specific arrival quota enforcement replacing global `ceil(totalSeats / 12)`
- [ ] True seat-specific interval availability algorithm eliminating the 115-minute phantom concurrency trap
- [ ] Seat allocation preserving primary channels without circular cross-channel cannibalization
- [ ] Student reservation API (`/api/me/cbtf/reservations`) supporting 30m and 60m durations and offset quota checks
- [ ] Student UI rendering 30-minute or 60-minute slot options based on assignment configuration
- [ ] Teacher assignment configuration UI allowing instructors to toggle 30-minute quiz vs 60-minute exam
- [ ] 100% Vitest unit test coverage for new allocation math, slot generation, and booking endpoints

---

## Phases

### Phase 1: Domain Modeling & Allocation Mathematics

**Status**: ⬜ Not Started  
**Objective**: Update Prisma schema to add `Assignment.cbtfDurationMinutes` and `CbtfFacility.elasticSeatCount`. Implement core allocation math in `server/utils/cbtf.ts`: partitioned seat indices, offset arrival quotas (`getMaxArrivalsForOffset`), and dedicated channel mapping for both 30-minute and 60-minute durations with comprehensive Vitest tests.  
**Requirements**: REQ-601, REQ-602, REQ-603, REQ-604, REQ-605

### Phase 2: Slot Generation & Reservation Booking APIs

**Status**: ⬜ Not Started  
**Objective**: Overhaul `generateAvailableSlotsForDate` in `server/utils/cbtf.ts` to replace the 115-minute rolling window filter with seat-specific interval availability. Update student booking and rescheduling endpoints (`reservations.post.ts`, `[id].patch.ts`) to validate offset quotas, support 30m/60m durations, and allocate seats cleanly within primary channels. Add high-load simulation tests proving zero phantom capacity dropouts.  
**Requirements**: REQ-606, REQ-607, REQ-608, REQ-611

### Phase 3: Student Scheduling Experience & Teacher Configuration UI

**Status**: ⬜ Not Started  
**Objective**: Update student CBTF booking composables and components to handle 30-minute and 60-minute slot increments dynamically. Update teacher assignment editing interface to allow setting 30-minute or 60-minute CBTF reservation durations with validation on test duration.  
**Requirements**: REQ-609, REQ-610

### Phase 4: Integration Verification, Proctor Hot-Spares & Final Audit

**Status**: ⬜ Not Started  
**Objective**: Verify end-to-end booking, proctor check-in and checkout flows, and test emergency hot-spare seat reassignments (Seats 19 & 20). Run full test suites across the repository to verify 100% behavioral coverage and zero regressions.  
**Requirements**: REQ-611
