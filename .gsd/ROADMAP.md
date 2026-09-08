# ROADMAP.md

> **Current Phase**: Phase 4 — Verification & Milestone Completion
> **Milestone**: v3.0 — LTI 1.3 NRPS Roster & Section Sync
> **Goal**: Implement automated course roster and section synchronization using LTI 1.3 Names and Role Provisioning Services (NRPS v2.0) with atomic concurrency gating, in-progress sync modal popup, and Teacher dashboard controls.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)

---

## Must-Haves (Milestone v3.0)

- [x] Schema fields on `Course` (`lastRosterSyncAt`, `isRosterSyncing`, `nrpsContextMembershipsUrl`)
- [x] Core NRPS client service with OAuth2 client credentials token exchange & pagination
- [x] Atomic concurrency gating for sync operations
- [x] LTI launch triggers (Teacher > 24h cooldown, Student missing section)
- [x] Dashboard in-progress sync modal popup with auto-close and data refresh
- [x] Teacher dashboard last sync timestamp & manual "Sync Roster Now" button
- [x] 100% unit test coverage for new services, endpoints, and components

## Phases

### Phase 1: Data Model & NRPS Core Service

**Status**: ✅ Complete
**Objective**: Add course schema fields with Prisma migration, and implement the NRPS client service with OAuth2 token negotiation and atomic locking.

### Phase 2: LTI Launch Integration & Concurrency Gating

**Status**: ✅ Complete
**Objective**: Integrate launch hooks in `handleLtiLaunch` with atomic concurrency gating, variable substitution, and redirect flagging.

### Phase 3: APIs & Dashboard Sync Modal

**Status**: ✅ Complete
**Objective**: Build sync status & trigger API endpoints, `RosterSyncModal.vue`, and integrate into Student and Teacher dashboards with manual sync button.

### Phase 4: Verification & Milestone Completion

**Status**: ✅ Complete
**Objective**: Run full lint and unit test suites, confirm behavioral coverage, and finalize milestone documentation.
