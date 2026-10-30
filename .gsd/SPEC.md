# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Project**: PassPort v1.2 External Tool Status & GTA Submission Links
> **Milestone**: v7.0 — PassPort v1.2 External Tool Status & GTA Submission Links

---

## Vision

Integrate the PassPort Protocol v1.2 status query specification to enable external Learning Tools (such as Web-CAT) to report student submission status, scoring metadata, staff inspection notices, and direct deep links. Surface this intelligence directly on Graduate Teaching Assistant (GTA) interview dashboard cards, equipping GTAs and instructors conducting 1-on-1 grading interviews with immediate, 1-click access to the student's latest submission and (when distinct) previous submission designated for grading, alongside critical automated inspection notices. The dashboard maintains freshness by automatically re-evaluating on-screen cards after a 15-minute staleness interval and offering instant manual sync.

---

## Goals

1. **PassPort Protocol v1.2 Schema & Registration Handshake**:
   - Update `LtiTool` model and Zod schemas to store `passportStatusUrl` alongside existing `passportExtensionUrl`.
   - Update PassPort dynamic registration handshake to support PassPort version `1.2` in Phase 1 and extract `endpoints.status_handler` during Phase 2 credential delivery.
   - Support manual admin editing and display of `passportStatusUrl` in the `ToolEditPanel.vue`.

2. **PassPort v1.2 Status Query Engine**:
   - Implement an HMAC-SHA256 authenticated query client in `server/utils/passport.ts` targeting `passportStatusUrl` (or standard `/passport/v1/status` fallback).
   - Formulate identifying payload with course `context`, student `user` (`lti_user_id`, `email`), and assignment `resource` (`lti_resource_link_id`, etc.) adhering to `extension-api.v1.2.md`.
   - Parse status responses with Zod schema validation:
     - `submission_for_grading`: active submission designated for grading evaluation.
     - `most_recent_submission`: optional submission present when different from `submission_for_grading`.
     - Extract `total_score`, `ta_score`, `submission_number`, `staff_notice` (HTML), and links (`grading_url` / `direct_url_grading` preferred for staff, falling back to `feedback_url` / `view_url`).

3. **Status Caching on GtaInterviewReservation**:
   - Add `submissionStatus` (Json) and `submissionStatusCheckedAt` (DateTime) to `GtaInterviewReservation` via Prisma migration.
   - Provide server endpoint `POST /api/me/courses/:courseId/interviews/:id/refresh-status` (and batch endpoint for visible IDs) to execute signed queries and persist status cache.
   - Project `submissionStatus` and `submissionStatusCheckedAt` in GTA interview feed responses (`GET /api/me/courses/:courseId/interviews`).

4. **GTA Interview Dashboard Presentation**:
   - Enhance GTA interview cards (Expected Arrivals queue and Active Interview in Progress) in `GtaInterviewConsole.vue`:
     - Clickable link to the student's **Latest Submission** (pointing to `most_recent_submission` if present, else `submission_for_grading`).
     - Separate clickable link to the **Submission for Grading** when `most_recent_submission` is present and distinct from `submission_for_grading`.
     - Links prioritize staff grading views (`grading_url` / `direct_url_grading` / `edit_url` / `grader_view_url`) with fallback to feedback URLs, opening in a new tab (`target="_blank"`).
     - Render optional `staff_notice` HTML fragment in a distinct inspection callout box with safe sanitization.
     - Provide a manual per-card refresh icon button with loading feedback.

5. **Screen-Bound 15-Minute Staleness & Polling**:
   - Restrict automatic 15-minute staleness checks exclusively to cards currently visible on screen (Active Interview and paginated Expected Arrivals).
   - Check staleness on card mount and execute a background refresh interval every 15 minutes while the dashboard is active.
   - Do not query or refresh off-screen, completed, or paginated-away reservations.

---

## Non-Goals (Out of Scope)

- Modifying PassPort extension granting logic (already completed in v2.0).
- Student-facing interview booking modifications (students already view their own submissions in LMS/tool).
- Offline or queue-based retry workers for external tool downtime; if the tool status query fails or times out, the dashboard displays an unobtrusive status warning while retaining existing cached data.

---

## Users & Roles

- **Graduate Teaching Assistants (GTAs)**: Conduct 1-on-1 interviews with students; need immediate deep links to student code/submissions and staff notices without switching browser tabs or manually looking up student IDs in Web-CAT.
- **Course Instructors**: Oversee grading interviews across all course GTAs, verify submission readiness, and audit student work.
- **Admins**: Configure or verify PassPort v1.2 endpoints and dynamic registration for external LTI tools.

---

## Constraints

- **Security & Request Signing**: Every outgoing status request to the tool must carry `X-PassPort-Client-ID`, `X-PassPort-Timestamp`, and `X-PassPort-Signature` (HMAC-SHA256).
- **HTML Sanitization**: External tools provide `staff_notice` as an HTML fragment; must be safely rendered without XSS vulnerability.
- **Layered Sovereignty & Docker Parity**: Follow GEMINI.md Nuxt 4 standards, Zod projection on all endpoints, and 100% Vitest behavioral coverage executed via Docker.

---

## Success Criteria

- [ ] Prisma migration successfully applies `passportStatusUrl` to `LtiTool` and `submissionStatus`, `submissionStatusCheckedAt` to `GtaInterviewReservation`.
- [ ] Tool dynamic registration handshake parses `endpoints.status_handler` and saves `passportStatusUrl`.
- [ ] PassPort v1.2 status query client constructs signed payloads and parses responses according to specification.
- [ ] Server refresh endpoint validates authorization and updates reservation status cache.
- [ ] GTA interview console shows latest submission link, grading submission link (if distinct), and staff notice on Expected Arrivals and Active Interview cards.
- [ ] Auto-refresh detects visible cards with `submissionStatusCheckedAt` older than 15 minutes (or null) and refreshes without querying off-screen records.
- [ ] 100% unit test pass rate across all new and existing tests.
