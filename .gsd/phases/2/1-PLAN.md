# Phase 2 Plan: Server APIs & Interview Projection

> Phase 2: Server APIs (Batch Upload, Management & Interview Projection)  
> Milestone: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews  
> Requirements: REQ-803, REQ-804

---

## 1. Objectives

1. Implement `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch` to resolve student identifiers (by email, university studentId, or userId) among enrolled students and batch upsert `StudentAssignmentNotice` records.
2. Implement `GET /api/me/courses/:courseId/assignments/:assignmentId/notices` to list uploaded notices for an assignment.
3. Implement `DELETE /api/me/courses/:courseId/assignments/:assignmentId/notices/:studentId` to remove a student's notice on an assignment.
4. Update `GET /api/me/courses/:courseId/interviews/index.get.ts` to attach `studentAssignmentNotice` (`{ id, notice, updatedAt } | null`) to each reservation returned in the TA interview feed.
5. Create comprehensive Vitest tests verifying authentication, authorization, identifier resolution, upsert counting, listing, deleting, and interview feed projection.

---

## 2. Tasks

### Task 1: Notice Management & Batch Upload Endpoints

- Create directory `server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/`.
- Create `batch.post.ts`:
  - Validate course and assignment exist and match.
  - Require instructor/admin/TA role via `assertCourseMember`.
  - Validate body with `batchUpsertStudentAssignmentNoticesSchema`.
  - Query enrollments for `courseId` to resolve identifiers (case-insensitive email, trimmed studentId, userId).
  - Batch upsert matching notices in a Prisma transaction, recording createdCount, updatedCount, and unmatchedIdentifiers.
  - Return `batchUpsertNoticesResultSchema`.
- Create `index.get.ts`:
  - Require instructor/admin/TA role via `assertCourseMember`.
  - Fetch notices for `assignmentId` with student and author details.
- Create `[studentId].delete.ts`:
  - Require instructor/admin/TA role via `assertCourseMember`.
  - Delete notice for `(assignmentId, studentId)` or return 404 if not found.

### Task 2: Project `studentAssignmentNotice` in TA Interview Feed

- In `server/api/me/courses/[courseId]/interviews/index.get.ts`:
  - Collect `(assignmentId, studentId)` pairs from fetched reservations.
  - Fetch corresponding `StudentAssignmentNotice` records.
  - Map `studentAssignmentNotice: { id: string; notice: string; updatedAt: Date } | null` onto each reservation.

### Task 3: Unit Testing & Verification

- Create `test/unit/server/api/assignment-notices.test.ts` for all notice endpoints.
- Update `test/unit/server/api/gta-interview-console.test.ts` to test feed projection.
- Run tests in Docker container `app-dev` via `pnpm vitest run`.

---

## 3. Verification Criteria

- All newly added endpoint tests pass (100% behavioral coverage).
- Existing GTA interview console tests pass.
- No TypeScript or schema validation regressions.
