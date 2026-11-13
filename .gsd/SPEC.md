# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Project**: Uploaded Staff Notices for TA Interviews
> **Milestone**: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews

---

## Vision

Enable teaching staff to upload internal staff notices (e.g. from autograders, plagiarism detection tools, or manual code review checklists) in bulk for all students on an assignment. Surface these notices directly within the TA Interview Console alongside any external tool notices (from PassPort v1.2), giving TAs immediate context during 1-on-1 grading interviews without relying solely on external dynamic tool handshakes.

---

## Goals

1. **Prisma Data Model (`StudentAssignmentNotice`)**:
   - Model `StudentAssignmentNotice` with fields `assignmentId`, `studentId`, `notice` (Text), `authorId` (User?), `createdAt`, and `updatedAt`.
   - Enforce `@@unique([assignmentId, studentId])` so each student has at most one notice per assignment.
   - Establish cascade deletion when an assignment or student is removed.
   - Execute a safe Prisma migration inside Docker.

2. **Shared Schemas & Validation Contracts**:
   - Define `studentAssignmentNoticeDtoSchema` and input schemas in `shared/schemas/assignment-notice.schema.ts`.
   - Support batch upload payload schema validating array of student identifier (email or student ID) and notice content.

3. **Server APIs for Notice Management & Interview Feed Integration**:
   - Create `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch` allowing instructors/TAs to upload notices for multiple students.
   - Create `GET /api/me/courses/:courseId/assignments/:assignmentId/notices` and `DELETE` endpoints for managing uploaded notices.
   - Project the uploaded notice into the interview feed (`GET /api/me/courses/:courseId/interviews`) so each reservation includes its corresponding `studentAssignmentNotice` or `staffNotice` payload.

4. **TA Interview Console Presentation**:
   - Update `GtaInterviewConsole.vue` (both Active Interview and Expected Arrivals cards) to display the uploaded staff notice alongside any external tool notice.
   - Use distinct badges/labels (e.g., "Course Staff Notice" vs "External Tool Notice").
   - Sanitize all notice HTML through `sanitizeStaffNoticeHtml()` to protect against XSS.

5. **Instructor Batch Upload UI**:
   - Provide an "Upload Staff Notices" modal accessible from the Teacher dashboard / assignment panel or TA console.
   - Support pasting CSV/TSV/JSON (e.g., `email,notice`) with preview and instant bulk upsert.

6. **Comprehensive Verification**:
   - 100% Vitest behavioral coverage for models, server APIs, and UI components.
   - Zero test regressions across all repository suites.

---

## Non-Goals (Out of Scope)

- Student-facing display of internal staff notices (notices are strictly internal to course staff and TAs).
- Arbitrary file attachments inside staff notices (notices are text/HTML fragments).
- Per-slot interview notices (notices are tied to the student's submission on that assignment).
