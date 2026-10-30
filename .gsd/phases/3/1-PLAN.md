---
phase: 3
plan: 1
wave: 1
depends_on: []
files_modified:
  - shared/utils/html.ts
  - test/unit/shared/utils/html.test.ts
  - app/composables/features/useGtaInterviewConsole.ts
  - test/unit/app/composables/useGtaInterviewConsole.spec.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - 'HTML sanitizer utility strips unsafe elements (<script>, <iframe>, event attributes) while preserving standard text formatting tags'
    - 'useGtaInterviewConsole exposes refreshReservationStatus for single-reservation manual refresh'
    - 'useGtaInterviewConsole evaluates visible cards and triggers batch refresh for records with missing or stale (>15min) status'
    - 'useGtaInterviewConsole starts a 15-minute polling interval that cleans up on unmount'
  artifacts:
    - 'shared/utils/html.ts exists with sanitizeStaffNoticeHtml export'
    - 'test/unit/shared/utils/html.test.ts passes all tests'
    - 'test/unit/app/composables/useGtaInterviewConsole.spec.ts passes all tests'
  key_links:
    - 'refreshReservationStatus calls POST /api/me/courses/:courseId/interviews/:id/refresh-status'
    - 'refreshVisibleStaleStatuses calls POST /api/me/courses/:courseId/interviews/refresh-status'
---

# Plan 3.1: Composable Submission Status Management & Staleness Engine

<objective>
Implement the client-side state management in `useGtaInterviewConsole` for PassPort v1.2 submission status queries, including on-demand single reservation refresh, on-screen 15-minute staleness evaluation, and periodic polling. Provide a dedicated HTML sanitization utility to safely render plugin-generated `staff_notice` content without XSS risk.

Purpose: Bridges the server APIs from Phase 2 to the UI presenter layer, ensuring visible interview cards display fresh submission data while respecting the 15-minute screen-bound polling invariant.
Output: `shared/utils/html.ts`, updated `useGtaInterviewConsole.ts`, and full unit test coverage.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- .gsd/DECISIONS.md (DECISION-019, DECISION-020, DECISION-021)
- app/composables/features/useGtaInterviewConsole.ts
- test/unit/app/composables/useGtaInterviewConsole.spec.ts
</context>

<tasks>

<task type="auto">
  <name>Create HTML sanitizer utility for staff notices</name>
  <files>
    shared/utils/html.ts
    test/unit/shared/utils/html.test.ts
  </files>
  <action>
    1. Create `shared/utils/html.ts`:
       - Export `sanitizeStaffNoticeHtml(rawHtml: string | null | undefined): string`:
         - If rawHtml is null, undefined, or empty, return empty string.
         - Strip dangerous tags (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<meta>`, `<link>`, `<form>`, `<input>`, `<button>`, `<svg>`, `<canvas>`, etc.).
         - Strip inline event handlers (e.g. `onload=`, `onerror=`, `onclick=`, etc.).
         - Strip `javascript:` and `data:` URIs in attributes.
         - Allow safe formatting tags (`<p>`, `<strong>`, `<b>`, `<em>`, `<i>`, `<u>`, `<span>`, `<ul>`, `<ol>`, `<li>`, `<br>`, `<code>`, `<pre>`, `<blockquote>`, `<a>` with http/https href).
    2. Create `test/unit/shared/utils/html.test.ts`:
       - Test that benign formatting tags (`<p>`, `<strong>`, `<code>`, `<ul>`) pass through intact.
       - Test that `<script>` and `<iframe>` blocks are stripped.
       - Test that `onerror`, `onload`, and `javascript:` URIs are neutralized.
       - Test null/undefined handling.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/shared/utils/html.test.ts`
  </verify>
  <done>
    `sanitizeStaffNoticeHtml` produces clean, safe HTML strings and passes all security test cases.
  </done>
</task>

<task type="auto">
  <name>Add submission status refresh and 15-minute staleness engine to useGtaInterviewConsole</name>
  <files>
    app/composables/features/useGtaInterviewConsole.ts
    test/unit/app/composables/useGtaInterviewConsole.spec.ts
  </files>
  <action>
    1. In `app/composables/features/useGtaInterviewConsole.ts`:
       - Add reactive state:
         - `refreshingStatusIds = ref<Set<string>>(new Set())` or `isRefreshingStatus = computed(...)` tracking active single/batch queries.
         - Track staleness constant: `STALENESS_THRESHOLD_MS = 15 * 60 * 1000` (15 minutes).
       - Implement `refreshReservationStatus(reservationId: string)`:
         - Call `POST /api/me/courses/${cId.value}/interviews/${reservationId}/refresh-status`.
         - On success, update the reservation in `feedResponse.value.data` in-place with the returned data.
         - Manage loading indicator in `refreshingStatusIds`.
       - Implement `refreshVisibleStaleStatuses(visibleReservationIds: string[])`:
         - Filter `visibleReservationIds` to records where `!reservation.submissionStatusCheckedAt` or `Date.now() - new Date(reservation.submissionStatusCheckedAt).getTime() >= STALENESS_THRESHOLD_MS`.
         - If any are stale, call batch endpoint `POST /api/me/courses/${cId.value}/interviews/refresh-status` with `{ reservationIds: staleIds }`.
         - Update matching reservations in `feedResponse.value.data` in-place.
       - Implement periodic 15-minute interval timer:
         - When console is mounted, periodically check visible reservations for staleness.
         - Clean up interval on `onUnmounted`.
       - Return `refreshReservationStatus`, `refreshVisibleStaleStatuses`, and `refreshingStatusIds` from the composable.
    2. In `test/unit/app/composables/useGtaInterviewConsole.spec.ts`:
       - Test `refreshReservationStatus` calls single endpoint and updates local feed item in-place.
       - Test `refreshVisibleStaleStatuses` ignores reservations checked within 15 minutes.
       - Test `refreshVisibleStaleStatuses` sends batch request for reservations checked >15 minutes ago or unchecked.
       - Test timer cleanup on unmount.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/app/composables/useGtaInterviewConsole.spec.ts`
  </verify>
  <done>
    `useGtaInterviewConsole` successfully manages single and batch status refreshing with in-place feed updates and passes all tests.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] HTML sanitization guarantees safe presentation of external plugin staff notices.
- [ ] `useGtaInterviewConsole` supports manual single-card refresh and background visible-card staleness sync.
- [ ] 15-minute polling interval is bounded and cleans up on unmount.
- [ ] All unit tests pass.
</verification>

<success_criteria>

- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] No regressions across existing console tests
      </success_criteria>
