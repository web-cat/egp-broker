---
updated: 2026-11-12T17:00:00-05:00
---

# Project State

## Current Position

**Milestone:** v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews  
**Phase:** Phase 4: Full Repository Verification, Security Audit & End-to-End Tests  
**Status:** ⏳ Phase 3 Complete, Ready for Phase 4  
**Roadmap:** [.gsd/ROADMAP.md](file:///Users/edwards/git/egp-broker/.gsd/ROADMAP.md)  
**Next Step:** Commit Phase 3 changes and execute Phase 4 (Full repository verification & milestone closeout).

## Completed Milestones

- **v1.0 — CBTF Scheduler** (Completed 2026-09-03)
- **v2.0 — PassPort Integration** (Completed 2026-09-06)
- **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08)
- **v4.0 — Proctor Training Mode** (Completed 2026-09-11)
- **v5.0 — Graduate TA Grading Interviews** (Completed 2026-09-16)
- **v6.0 — CBTF Phased Capacity & Duration Engine** (Completed 2026-10-09)
- **v7.0 — PassPort v1.2 External Tool Status & GTA Submission Links** (Completed 2026-10-30)

## Active Decisions

| Decision                                                               | Choice                                                                                                                                          | Made       | Affects        |
| :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :------------- |
| [DECISION-019](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) | Store `submissionStatus` and `submissionStatusCheckedAt` in `GtaInterviewReservation`; add `passportStatusUrl` to `LtiTool`                     | 2026-10-29 | Milestone v7.0 |
| [DECISION-020](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) | Prefer staff grading URL (`grading_url`) over feedback URL for GTA links; open in new tab                                                       | 2026-10-29 | Milestone v7.0 |
| [DECISION-021](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) | Screen-bound 15-minute staleness checks restricted strictly to visible cards, plus 15m polling & manual refresh button                          | 2026-10-29 | Milestone v7.0 |
| [DECISION-022](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) | Dedicated `StudentAssignmentNotice` model keyed on `@@unique([assignmentId, studentId])` for uploaded staff notices, independent of appointment | 2026-11-12 | Milestone v8.0 |

## Blockers

None.

## Concerns

None.
