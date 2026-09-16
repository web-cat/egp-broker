# ROADMAP.md

> **Current Phase**: Phase 1: Database Models & GTA Shift Management Engine
> **Milestone**: v5.0 — Graduate TA Grading Interviews
> **Goal**: Build a course-integrated 1-on-1 interview scheduling system with Graduate Teaching Assistants for assignment grading, featuring recurring disconnected shift builder, overlapping slot capacity, automatic GTA assignment, pass redemption gating, and a dedicated GTA check-in/checkout & notes console.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)
- ✅ **v4.0 — Proctor Training Mode** (Completed 2026-09-11) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v4.0-proctor-training-mode-SUMMARY.md)

---

## Must-Haves (Milestone v5.0)

- [ ] Database models & migration: `Course.interviewLocation`, `Assignment.hasInterviews`, `Assignment.interviewWindowStart/End`, `GtaShift`, `GtaInterviewReservation`
- [ ] Role check & authorization: only users with course role `TA` or instructor can be scheduled
- [ ] Recurring disconnected shift parser & batch generator for GTAs (course instructors manage all, GTAs manage their own)
- [ ] 10-minute slot availability engine (5m interview + 5m prep) with aggregated capacity across overlapping GTAs
- [ ] Half-day block filtering matching slots within the assignment's interview window
- [ ] Student booking API assigning an available GTA on duty and returning confirmation with assigned GTA & course location
- [ ] Student appointment constraints: at most one active scheduled interview; rescheduling allowed if completed, cancelled, or missed/no-show
- [ ] Resubmission pass redemption gating in `server/utils/redemptions.ts` (blocks non-extension passes if interview not completed)
- [ ] GTA console (`/interviews`): expected arrivals for active shift, manual check-in, active interview panel with notes, checkout, and mark no-show
- [ ] Course settings & assignment edit UI for configuring location and interview requirements
- [ ] Student interview scheduling UI
- [ ] 100% Vitest unit test coverage for new endpoints, utilities, and components

---

## Phases

### Phase 1: Database Models & GTA Shift Management Engine

**Status**: ✅ Complete  
**Objective**: Update Prisma schema, create database migration for `Course.interviewLocation`, `Assignment.hasInterviews`, `interviewWindowStart/End`, `GtaShift`, and `GtaInterviewReservation`. Implement course-scoped GTA shift CRUD endpoints with role authorization (instructors can manage all, GTAs can manage their own) and weekly batch generation using the schedule parser.  
**Requirements**: REQ-501, REQ-502, REQ-503

### Phase 2: Slot Generation, Booking API & Pass Redemption Gating

**Status**: ✅ Complete  
**Objective**: Build server algorithm for 10-minute slots, calculate overlapping GTA capacity, filter half-day blocks, implement student reservation booking and cancellation with automatic GTA assignment, and hook into `redemptions.ts` to gate resubmission passes until interview completion.  
**Requirements**: REQ-504, REQ-505, REQ-506, REQ-509

### Phase 3: Student Scheduling Experience & Course Settings UI

**Status**: ⬜ Not Started  
**Objective**: Implement student scheduling UI (adapted from CBTF half-day selection), booking confirmation view, rescheduling flow, and course/assignment configuration panels in the teacher interface.  
**Requirements**: REQ-510, REQ-511

### Phase 4: GTA Interview Dashboard, Notes Console & Full Verification

**Status**: ⬜ Not Started  
**Objective**: Build the GTA interview dashboard showing expected arrivals for the GTA's active shift, manual check-in, active interview panel with observation/grading notes, checkout button, no-show marker, and conduct complete unit and integration verification.  
**Requirements**: REQ-507, REQ-508, REQ-512
