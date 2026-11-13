# ROADMAP.md

> **Current Status**: Milestone v8.0 Complete
> **Milestone**: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews
> **Goal**: Implement `StudentAssignmentNotice` model, batch upload API, and TA interview console presentation so course staff can upload internal grading notices in bulk and view them alongside external tool notices on interview cards.

## Completed Milestones

- ✅ **v1.0 — CBTF Scheduler** (Completed 2026-09-03) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v1.0-cbtf-scheduler-SUMMARY.md)
- ✅ **v2.0 — PassPort Integration** (Completed 2026-09-06) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v2.0-passport-integration-SUMMARY.md)
- ✅ **v3.0 — LTI 1.3 NRPS Roster & Section Sync** (Completed 2026-09-08) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v3.0-nrps-roster-sync-SUMMARY.md)
- ✅ **v4.0 — Proctor Training Mode** (Completed 2026-09-11) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v4.0-proctor-training-mode-SUMMARY.md)
- ✅ **v5.0 — Graduate TA Grading Interviews** (Completed 2026-09-16) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v5.0-gta-grading-interviews-SUMMARY.md)
- ✅ **v6.0 — CBTF Phased Capacity & Duration Engine** (Completed 2026-10-09) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v6.0-cbtf-phased-capacity-SUMMARY.md)
- ✅ **v7.0 — PassPort v1.2 External Tool Status & GTA Submission Links** (Completed 2026-10-30) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v7.0-passport-status-gta-links-SUMMARY.md)
- ✅ **v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews** (Completed 2026-11-12) — [Summary](file:///Users/edwards/git/egp-broker/.gsd/milestones/v8.0-uploaded-staff-notices-SUMMARY.md)

---

## Must-Haves (Milestone v8.0)

- [x] Database support for `StudentAssignmentNotice` with `assignmentId`, `studentId`, `notice`, `authorId`, `createdAt`, `updatedAt`, and `@@unique([assignmentId, studentId])`
- [x] Shared Zod schemas for `StudentAssignmentNoticeDto` and batch upload payload
- [x] Server batch upload endpoint `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch`
- [x] Server management endpoints to list and delete uploaded notices for an assignment
- [x] Projection of uploaded `studentAssignmentNotice` / `staffNotice` in `GET /api/me/courses/:courseId/interviews`
- [x] UI rendering of uploaded staff notices in `GtaInterviewConsole.vue` (both Active Interview and Expected Arrivals) alongside external tool notices
- [x] Batch upload modal in teacher interface for pasting and uploading CSV/TSV/JSON notices
- [x] 100% Vitest behavioral coverage across new models, endpoints, and UI components

---

## Phases

### Phase 1: Data Model, Migration & Shared Schemas

**Status**: ✅ Complete  
**Objective**: Add `StudentAssignmentNotice` model to Prisma schema with reciprocal relations on `Assignment` and `User`. Run Prisma migration. Create Zod schemas and TypeScript interfaces in `shared/schemas/assignment-notice.schema.ts`.  
**Requirements**: REQ-801, REQ-802

### Phase 2: Server APIs (Batch Upload, Management & Interview Projection)

**Status**: ✅ Complete  
**Objective**: Implement server endpoints for batch uploading notices, retrieving notices, and projecting student assignment notices in the GTA interview feed (`GET /api/me/courses/:courseId/interviews`).  
**Requirements**: REQ-803, REQ-804

### Phase 3: TA Interview Console UI Display & Batch Upload Modal

**Status**: ✅ Complete  
**Objective**: Update `GtaInterviewConsole.vue` cards to display uploaded course staff notices alongside external tool notices with distinct callouts and sanitization. Build an "Upload Staff Notices" modal for teachers to paste CSV/TSV/JSON notices.  
**Requirements**: REQ-805, REQ-806

### Phase 4: Full Repository Verification, Security Audit & End-to-End Tests

**Status**: ✅ Complete  
**Objective**: Run complete Vitest suite across all 192 test files, audit HTML sanitization against XSS, and verify end-to-end multi-notice display and upload flows.  
**Requirements**: REQ-807  
**Objective**: Run complete Vitest suite across all 188+ test files, audit HTML sanitization against XSS, and verify end-to-end multi-notice display and upload flows.  
**Requirements**: REQ-807
