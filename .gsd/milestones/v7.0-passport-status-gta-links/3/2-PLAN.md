---
phase: 3
plan: 2
wave: 2
depends_on:
  - 1
files_modified:
  - app/components/features/gta/GtaInterviewConsole.vue
  - test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - 'Active Interview card renders clickable deep link to latest student submission opening in new tab'
    - 'Active Interview card renders distinct clickable deep link to submission for grading when present and different from latest submission'
    - 'Active Interview card renders sanitized HTML staff notice banner when present'
    - 'Expected Arrival cards render deep links to latest and grading submissions, and staff notice callout'
    - 'Both Active and Expected Arrival cards feature a manual refresh icon button with loading state'
    - 'Visible cards on the dashboard trigger staleness check and batch refresh for stale entries'
  artifacts:
    - 'app/components/features/gta/GtaInterviewConsole.vue updated with submission links, staff notices, and refresh buttons'
    - 'test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts passes all tests'
  key_links:
    - 'Submission links prefer grading_url over feedback_url (DECISION-020)'
    - "Links use target='_blank' and rel='noopener noreferrer'"
    - 'Visible cards are bound strictly to active interview and paginated arrivals (DECISION-021)'
---

# Plan 3.2: GTA Interview Dashboard Cards UI & Deep Link Integration

<objective>
Update the GTA Interview Console presenter component (`GtaInterviewConsole.vue`) to display clickable deep links to the student's latest submission and grading submission, render sanitized HTML staff notice callouts, and provide manual per-card refresh triggers with spinner feedback. Connect visible on-screen cards to the composable's 15-minute staleness check.

Purpose: Delivers the core user-facing functionality of milestone v7.0 directly into the GTA interview workflow.
Output: Updated `GtaInterviewConsole.vue` and comprehensive component unit tests.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- .gsd/DECISIONS.md (DECISION-019, DECISION-020, DECISION-021)
- shared/utils/html.ts
- app/composables/features/useGtaInterviewConsole.ts
- app/components/features/gta/GtaInterviewConsole.vue
- test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts
</context>

<tasks>

<task type="auto">
  <name>Update GtaInterviewConsole.vue to render submission links, staff notices, and refresh buttons</name>
  <files>
    app/components/features/gta/GtaInterviewConsole.vue
  </files>
  <action>
    1. In `app/components/features/gta/GtaInterviewConsole.vue`:
       - Import `sanitizeStaffNoticeHtml` from `@@/shared/utils/html`.
       - From `useGtaInterviewConsole`, extract `refreshReservationStatus`, `refreshVisibleStaleStatuses`, and `refreshingStatusIds`.
       - Compute `visibleReservationIds`:
         - Computed array containing `activeInterview.value?.id` (if present) and all `paginatedExpectedArrivals.value.map(r => r.id)`.
       - Trigger `refreshVisibleStaleStatuses(visibleReservationIds.value)` on component mount and watch `visibleReservationIds`.
       - In **Active In-Progress Interview Hero Panel**:
         - In the Student & Assignment details column:
           - Add a "Submissions & Assessment" section:
             - Header with section title and manual refresh icon button:
               - Button icon `i-lucide-refresh-cw`, `:loading="refreshingStatusIds.has(activeInterview.id)"`, `@click="refreshReservationStatus(activeInterview.id)"`.
             - If `activeInterview.submissionStatus?.latestSubmissionUrl`:
               - Render a deep link button/anchor with icon `i-lucide-external-link`, `target="_blank"`, `rel="noopener noreferrer"`.
               - Text: `Latest Submission` + (if `latestSubmissionNumber` present: `(#${activeInterview.submissionStatus.latestSubmissionNumber})`).
             - If `activeInterview.submissionStatus?.gradingSubmissionUrl` and distinct from `latestSubmissionUrl`:
               - Render a second deep link button/anchor with icon `i-lucide-external-link`, `target="_blank"`, `rel="noopener noreferrer"`.
               - Text: `Submission for Grading` + (if `gradingSubmissionNumber` present: `(#${activeInterview.submissionStatus.gradingSubmissionNumber})`).
             - If `activeInterview.submissionStatus?.staffNotice`:
               - Render an alert/callout box:
                 - Icon `i-lucide-info` or `i-lucide-alert-triangle`.
                 - HTML content rendered via `v-html="sanitizeStaffNoticeHtml(activeInterview.submissionStatus.staffNotice)"`.
                 - Styled with subtle warning/info background (`bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg p-2.5 text-xs`).
             - If status query checked but no submissions found:
               - Show subtle text: `No student submissions recorded yet`.
       - In **Expected Arrivals Queue Cards**:
         - For each `reservation` in `paginatedExpectedArrivals`:
           - Add a submission links and staff notice block:
             - Include manual refresh icon button next to assignment badge or submission status.
             - Render latest submission link (`target="_blank"` with external link icon).
             - Render distinct grading submission link (if present and different from latest).
             - Render sanitized staff notice callout banner (if present).
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts`
  </verify>
  <done>
    `GtaInterviewConsole.vue` renders all submission deep links, staff notice callouts, and per-card manual refresh buttons for active and expected arrival cards.
  </done>
</task>

<task type="auto">
  <name>Expand GtaInterviewConsole.spec.ts with behavioral tests</name>
  <files>
    test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts
  </files>
  <action>
    1. In `test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts`:
       - Add test cases verifying:
         - Active interview renders `target="_blank"` link to latest submission.
         - Active interview renders separate grading link when `gradingSubmissionUrl` is distinct.
         - Active interview does NOT render separate grading link when it matches `latestSubmissionUrl`.
         - Active interview renders sanitized HTML staff notice inside notice banner.
         - Expected arrivals cards render deep links and staff notice.
         - Clicking per-card refresh button invokes `refreshReservationStatus(reservationId)`.
         - Component triggers `refreshVisibleStaleStatuses` for visible cards on mount.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts`
  </verify>
  <done>
    All component unit tests pass, confirming UI presentation, link targets, and refresh triggers.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Active Interview panel renders latest submission and grading submission links opening in new tab.
- [ ] Expected Arrival cards render submission deep links and staff notice callout.
- [ ] Manual refresh icon button triggers refresh with loading spinner.
- [ ] All unit tests pass with zero regressions.
</verification>

<success_criteria>

- [ ] All tasks verified
- [ ] Must-haves confirmed
- [ ] Complete behavioral test coverage
      </success_criteria>
