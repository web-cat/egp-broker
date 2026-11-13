# REQUIREMENTS.md

## Functional Requirements

| ID | Requirement | Source | Status |
| ID | Requirement | Source | Status | Verification Proof |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------- | :------- | :----------------- |
| **REQ-601** | Support 30-minute and 60-minute reservation durations at the Assignment level (`durationMinutes`) | SPEC Goal 2 | Complete | Prisma schema migration `20261009234231` & `assignment.schema.test.ts` |
| **REQ-602** | Configure facility elastic seat reserve (`elasticSeatCount`, defaulting to 2) preserving seats for hot spares | SPEC Goal 1, 4 | Complete | Prisma schema migration `20261009234231` & `cbtf.test.ts` |
| **REQ-603** | Implement 18 phased seats with alternating 2–1 distribution across 12 offsets for 60-minute duration | SPEC Goal 1 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-604** | Implement 18 phased seats with 3 seats per offset across 6 offsets for 30-minute duration | SPEC Goal 2 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-605** | Enforce offset-specific arrival quotas matching seat allocations (`getMaxArrivalsForOffset`) | SPEC Goal 1 | Complete | `cbtf.test.ts` & `cbtf-reservations.test.ts` |
| **REQ-606** | Replace rolling 115-minute overlap count with true seat-specific interval availability check in `generateAvailableSlotsForDate` | SPEC Goal 3 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-607** | Allocate seats strictly within primary offset channels without circular cross-channel cannibalization in `assignNextSeat` | SPEC Goal 3 | Complete | `cbtf.test.ts` & `cbtf-reservations.test.ts` |
| **REQ-608** | Update student booking endpoint to validate arrival quota and duration-matched seat availability | SPEC Goal 3 | Complete | `server/api/me/cbtf-reservations.test.ts` |
| **REQ-609** | Update student CBTF booking UI to display slots matching assignment duration (30 min vs 60 min) | SPEC Goal 5 | Complete | `test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts` |
| **REQ-610** | Provide teacher settings controls to toggle CBTF assignment duration (30m vs 60m) | SPEC Goal 5 | Complete | `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts` |
| **REQ-611** | Full Vitest test suite validating high-throughput scenario with 0 phantom capacity dropouts | SPEC Goal 3 | Complete | `test/unit/server/utils/cbtf-simulation.test.ts` |
| **REQ-701** | Update `LtiTool` schema and admin UI to support `passportStatusUrl` and PassPort v1.2 dynamic registration (`endpoints.status_handler`) | SPEC Goal 1 | Complete | `passport.test.ts`, `lti-tools.test.ts`, `ToolEditPanel.spec.ts` |
| **REQ-702** | Update `GtaInterviewReservation` model to store `submissionStatus` (Json) and `submissionStatusCheckedAt` (DateTime) | SPEC Goal 1 | Complete | Migration `20261030001436_add_passport_v12_status_fields` & `cbtf-reservations.test.ts` |
| **REQ-703** | Implement PassPort v1.2 submission status client service in `server/utils/passport.ts` with HMAC-SHA256 signed requests | SPEC Goal 2 | Complete | `passport-status.test.ts` (15 tests passing) |
| **REQ-704** | Parse status responses extracting latest submission, submission for grading, scores, and HTML staff notice | SPEC Goal 2 | Complete | `passport-status.test.ts` & `html.test.ts` |
| **REQ-705** | Provide interview status refresh endpoints (`POST /api/me/courses/:courseId/interviews/:id/refresh-status` and batch endpoint) | SPEC Goal 3 | Complete | `gta-interview-refresh-status.test.ts` (13 tests passing) |
| **REQ-706** | Project `submissionStatus` and `submissionStatusCheckedAt` in GTA interview feed responses | SPEC Goal 3 | Complete | `gta-interview.test.ts` & `gta-interview-refresh-status.test.ts` |
| **REQ-707** | Implement composable status management with 15-minute staleness check for visible cards and periodic polling | SPEC Goal 4 | Complete | `useGtaInterviewConsole.spec.ts` (14 tests passing) |
| **REQ-708** | Render clickable links for latest submission, submission for grading (if different), and HTML staff notice on cards | SPEC Goal 4 | Complete | `GtaInterviewConsole.spec.ts` (20 tests passing) |
| **REQ-709** | Provide manual per-card refresh button on Expected Arrivals and Active Interview cards | SPEC Goal 4 | Complete | `GtaInterviewConsole.spec.ts` (20 tests passing) |
| **REQ-710** | Comprehensive Vitest unit tests verifying protocol signing, status parsing, refresh scheduling, and UI cards | SPEC Goal 5 | Complete | Full repo unit test sweep (188/188 files, 1260/1260 tests passing) |
| **REQ-801** | Add `StudentAssignmentNotice` Prisma model with `assignmentId`, `studentId`, `notice`, `authorId`, `createdAt`, `updatedAt`, and unique constraint `@@unique([assignmentId, studentId])` | SPEC Goal 1 | Complete | Migration `20261112221910_add_student_assignment_notice` |
| **REQ-802** | Add Zod validation schemas for `StudentAssignmentNotice` DTOs and batch upload payload in `shared/schemas/assignment-notice.schema.ts` | SPEC Goal 2 | Complete | `assignment-notice.schema.test.ts` (14 tests passing) |
| **REQ-803** | Implement batch upload endpoint `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch` and management endpoints | SPEC Goal 3 | Pending | — |
| **REQ-804** | Project uploaded `studentAssignmentNotice` / `staffNotice` in TA interview feed responses (`GET /api/me/courses/:courseId/interviews`) | SPEC Goal 3 | Pending | — |
| **REQ-805** | Render uploaded course staff notices in `GtaInterviewConsole.vue` alongside external tool notices, sanitized via `sanitizeStaffNoticeHtml` | SPEC Goal 4 | Pending | — |
| **REQ-806** | Provide teacher batch upload UI modal with CSV/TSV/JSON paste, preview, and submission | SPEC Goal 5 | Pending | — |
| **REQ-807** | Comprehensive Vitest test suite verifying models, batch upload endpoint, interview projection, and UI notice rendering | SPEC Goal 6 | Pending | — |
