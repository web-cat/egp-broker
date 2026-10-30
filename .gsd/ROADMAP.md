# ROADMAP.md

> **Current Phase**: Phase 1: Data Models & Registration Protocol v1.2
> **Milestone**: v7.0 — PassPort v1.2 External Tool Status & GTA Submission Links
> **Goal**: Implement PassPort Protocol v1.2 status query support for external LTI tools, caching submission metadata on interview reservations, and displaying deep links to latest/grading submissions and staff notices on GTA interview cards with 15-minute screen-bound staleness refresh.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)
- ✅ **v4.0 — Proctor Training Mode** (Completed 2026-09-11) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v4.0-proctor-training-mode-SUMMARY.md)
- ✅ **v5.0 — Graduate TA Grading Interviews** (Completed 2026-09-16) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v5.0-gta-grading-interviews-SUMMARY.md)
- ✅ **v6.0 — CBTF Phased Capacity & Duration Engine** (Completed 2026-10-09) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v6.0-cbtf-phased-capacity-SUMMARY.md)

---

## Must-Haves (Milestone v7.0)

- [ ] Database support for `LtiTool.passportStatusUrl` and `GtaInterviewReservation.submissionStatus` / `submissionStatusCheckedAt`
- [ ] PassPort v1.2 dynamic registration handshake supporting `passport_version: '1.2'` and extracting `endpoints.status_handler`
- [ ] Admin tool configuration panel support for viewing and editing `passportStatusUrl`
- [ ] HMAC-SHA256 authenticated PassPort status query engine with Zod schema validation
- [ ] Server endpoints for interview submission status refresh and projection in GTA interview feeds
- [ ] Clickable deep link to latest student submission on GTA dashboard cards (preferring staff grading view, opening in new tab)
- [ ] Separate clickable deep link to submission for grading when distinct from latest submission
- [ ] Rendered HTML `staff_notice` callout on GTA interview cards
- [ ] Screen-bound 15-minute staleness auto-refresh and periodic polling for visible dashboard cards
- [ ] Manual refresh icon button on cards for immediate sync
- [ ] 100% Vitest behavioral test coverage across all new and existing features

---

## Phases

### Phase 1: Data Models & Registration Protocol v1.2

**Status**: ⬜ Not Started  
**Objective**: Update Prisma schema to add `passportStatusUrl` to `LtiTool`, and `submissionStatus` (Json) / `submissionStatusCheckedAt` (DateTime) to `GtaInterviewReservation`. Execute migration. Update shared schemas (`passport.ts`, `tool.ts`). Support PassPort version `1.2` in Phase 1 and parse `endpoints.status_handler` in Phase 2 callback. Update admin `ToolEditPanel.vue` for `passportStatusUrl`.  
**Requirements**: REQ-701, REQ-702

### Phase 2: PassPort v1.2 Status Query Client & Server APIs

**Status**: ⬜ Not Started  
**Objective**: Implement PassPort v1.2 signed status query function in `server/utils/passport.ts` (`queryPassPortSubmissionStatus`). Build identifying payload (`context`, `user`, `resource`) and sign with HMAC-SHA256 headers. Parse and validate response with Zod. Create server endpoints to query and update status cache (`POST /api/me/courses/:courseId/interviews/:id/refresh-status` and batch endpoint). Include `submissionStatus` and `submissionStatusCheckedAt` in `GET /api/me/courses/:courseId/interviews`.  
**Requirements**: REQ-703, REQ-704, REQ-705, REQ-706

### Phase 3: GTA Dashboard Cards & Periodic Staleness Refresh

**Status**: ⬜ Not Started  
**Objective**: Update GTA interview console composables (`useGtaInterviewConsole`) to handle on-screen 15-minute staleness checks, background 15-minute polling interval, and per-card manual refresh action. Update `GtaInterviewConsole.vue` cards (Expected Arrivals and Active Interview in Progress) to display clickable link to latest submission, separate link to submission for grading (if distinct), rendered HTML `staff_notice`, and manual refresh button.  
**Requirements**: REQ-707, REQ-708, REQ-709

### Phase 4: Verification, Security Audit & End-to-End Tests

**Status**: ⬜ Not Started  
**Objective**: Comprehensive Vitest test suite covering PassPort v1.2 handshake, signed status requests, malformed/null response resilience, HTML staff notice sanitization, screen-bound 15-minute staleness checks, manual refresh flows, and regression suite execution.  
**Requirements**: REQ-710
