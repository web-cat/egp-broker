# ROADMAP.md

> **Current Phase**: Milestone Complete
> **Milestone**: v4.0 — Proctor Training Mode
> **Goal**: Implement an in-memory, zero-database-write training environment at `/proctor/training` that uses the standard Proctor Console UI with dynamic fictional scenarios, physical ID card scanner support, mismatch toggle pill, and arrival queue advancement.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)
- ✅ **v4.0 — Proctor Training Mode** (Completed 2026-09-11) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v4.0-proctor-training-mode-SUMMARY.md)

---

## Must-Haves (Milestone v4.0)

- [x] In-memory reactive training engine composable (`useCbtfProctorTraining.ts`) with zero database writes
- [x] Realistic dynamic fictional scenarios generated relative to current time (standard arrival, early arrival, late arrival, and seated students)
- [x] Physical scanner support: allow any scanned ID to match the active training scenario
- [x] "Next Scan: Mismatch" toggle pill to simulate unmatched/unregistered student turn-away workflow
- [x] "Next Scheduled Arrival ⏭️" pill to advance through simulated arriving student queue
- [x] Reusable Proctor Console presenter (`ProctorConsole.vue`) shared by production and training views
- [x] Dedicated route at `/proctor/training` guarded by `proctor-only` middleware with clear training mode banner and controls
- [x] "Enter Training Mode" entry point button on `/proctor/index.vue`
- [x] 100% unit test coverage for training composables and components

## Phases

### Phase 1: In-Memory Training Engine & Scenario Generator

**Status**: ✅ Complete
**Objective**: Build `useCbtfProctorTraining.ts` providing realistic dynamic timestamps, card scanner mapping, next arrival queue pointer, mismatch toggle pill, check-in, check-out, and incident note handlers with 100% unit tests.

### Phase 2: Reusable Console Presenter & Training Sandbox View

**Status**: ✅ Complete
**Objective**: Extract `ProctorConsole.vue`, create `/proctor/training` page with distinctive training banner and control bar, and link from `/proctor/index.vue`.

### Phase 3: Verification, Edge Cases & Milestone Completion

**Status**: ✅ Complete
**Objective**: Run complete test suite, verify linting, conduct browser validation, and finalize documentation.
