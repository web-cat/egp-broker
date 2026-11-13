# Phase 2 Summary: Server APIs & Interview Projection

> Phase 2: Server APIs (Batch Upload, Management & Interview Projection)  
> Milestone: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews  
> Completed: 2026-11-12T20:18:00-05:00

---

## 1. Work Completed

1. **Batch Upload Endpoint**:
   - Implemented `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch` (`server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/batch.post.ts`).
   - Resolves student identifiers against enrolled students in `courseId` using:
     - Case-insensitive email matching.
     - Trimmed university `studentId` matching.
     - Direct `userId` matching.
   - Collects unmatched identifiers in `unmatchedIdentifiers` array.
   - Batch upserts matched items in a single Prisma transaction with `authorId = user.id`.
   - Returns `{ createdCount, updatedCount, unmatchedIdentifiers, totalProcessed }`.

2. **Notice Listing Endpoint**:
   - Implemented `GET /api/me/courses/:courseId/assignments/:assignmentId/notices` (`server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/index.get.ts`).
   - Retrieves all uploaded notices for an assignment, joining student information (`id`, `firstName`, `lastName`, `email`, `studentId`, `avatarUrl`) and author details.

3. **Notice Deletion Endpoint**:
   - Implemented `DELETE /api/me/courses/:courseId/assignments/:assignmentId/notices/:studentId` (`server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/[studentId].delete.ts`).
   - Verifies assignment and notice existence before removing the record.

4. **TA Interview Feed Projection**:
   - Updated `GET /api/me/courses/:courseId/interviews/index.get.ts` to batch-fetch all matching `StudentAssignmentNotice` records for unique `(assignmentId, studentId)` pairs across all reservations.
   - Appends `studentAssignmentNotice: { id: string; notice: string; updatedAt: Date } | null` onto each returned reservation object.

5. **Behavioral Testing**:
   - Created `test/unit/server/api/assignment-notices.test.ts` (13 tests) covering authentication, role-based authorization (instructors and TAs permitted; students rejected with 403), identifier resolution, transaction counting, notice listing, and individual deletion.
   - Updated `test/unit/server/api/gta-interview-console.test.ts` (12 tests) verifying that `studentAssignmentNotice` is properly projected and attached to active/upcoming reservation feeds.
   - All 5 related test files passed (71/71 tests passing).

---

## 2. Verification

- All 13 tests in `test/unit/server/api/assignment-notices.test.ts` passed.
- All 12 tests in `test/unit/server/api/gta-interview-console.test.ts` passed.
- Regression suite across all GTA interview, schema, and notice tests (71 tests) passed with 0 failures.
