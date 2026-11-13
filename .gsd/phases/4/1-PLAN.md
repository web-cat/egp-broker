# Phase 4 Plan: Full Repository Verification & Milestone Closeout

> Phase 4: Full Repository Verification, Security Audit & End-to-End Tests  
> Milestone: v8.0 — Uploaded Staff Notices (`StudentAssignmentNotice`) for TA Interviews  
> Requirements: REQ-807

---

## 1. Objectives

1. Execute the entire Vitest test suite across all 190+ test files in the repository inside the Docker container to ensure zero regressions across any domain (CBTF, GTA, PassPort, Auth, Admin, etc.).
2. Conduct a security audit confirming that both PassPort external notices and uploaded `StudentAssignmentNotice` strings are rigorously sanitized by `sanitizeStaffNoticeHtml()` against script injection, event handlers, and malicious URIs.
3. Mark all requirements (REQ-801 through REQ-807) as Complete in `.gsd/REQUIREMENTS.md`.
4. Update `.gsd/ROADMAP.md` and `.gsd/STATE.md` marking Milestone v8.0 Complete.
5. Create milestone archive summary `.gsd/milestones/v8.0-uploaded-staff-notices-SUMMARY.md`.
6. Commit all milestone verification and closeout artifacts following conventional commit guidelines.
