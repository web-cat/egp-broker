# Phase 3 Plan: TA Interview Console UI Display & Batch Upload Modal

> Phase 3: TA Interview Console UI Display & Batch Upload Modal  
> Milestone: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews  
> Requirements: REQ-805, REQ-806

---

## 1. Objectives

1. Create `shared/utils/notice-parser.ts` with comprehensive unit tests in `test/unit/shared/utils/notice-parser.test.ts` to parse CSV, TSV, and JSON formats into `{ studentIdentifier: string; notice: string }[]`.
2. Add `GET /api/me/courses/:courseId/assignments/index.get.ts` to list course assignments for selection in the modal.
3. Build `StudentAssignmentNoticeModal.vue` (`app/components/features/gta/StudentAssignmentNoticeModal.vue`):
   - Assignment selector dropdown.
   - Multiline textarea for pasting CSV/TSV/JSON notices or dropping files.
   - Live parsing and row count preview with table view.
   - Submit action calling `POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch`.
   - Results summary (created, updated, unmatched identifiers) and toast notifications.
4. Update `GtaInterviewConsole.vue`:
   - Add "Upload Notices" action button to console header.
   - Mount `StudentAssignmentNoticeModal.vue`.
   - In Active Interview card and Expected Arrivals queue cards:
     - Render `Course Staff Notice` callout box when `studentAssignmentNotice?.notice` is present.
     - Sanitize notice with `sanitizeStaffNoticeHtml(...)`.
     - Display alongside `External Tool Notice` when both exist.
5. Create Vitest component tests in:
   - `test/unit/app/components/features/gta/StudentAssignmentNoticeModal.spec.ts`
   - Update `test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts` for dual notice rendering.
6. Verify and iterate until all tests pass in Docker.
