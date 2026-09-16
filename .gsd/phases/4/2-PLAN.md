---
phase: 4
plan: 2
wave: 2
---

# Plan 4.2: GTA Interview Dashboard & Notes Console UI + Full Integration & Verification

## Objective

Build the user interface for the Graduate TA Interview Console (`GtaInterviewConsole.vue` and `/interviews` page route) featuring expected arrivals, manual check-in, an active 1-on-1 interview panel with elapsed timer and observation/grading notes, checkout flow, and no-show flag. Conduct complete regression testing and verification across the full milestone.

## Context

- `.gsd/SPEC.md` (Goal 5)
- `.gsd/REQUIREMENTS.md` (REQ-507, REQ-508, REQ-509, REQ-512)
- `app/composables/features/useGtaInterviewConsole.ts`
- `app/components/features/gta/GtaInterviewConsole.vue`
- `app/pages/interviews/index.vue`
- `app/components/features/dashboard/Teacher.vue`
- `app/layouts/default.vue`

## Tasks

<task type="auto">
  <name>Build GtaInterviewConsole Feature Component</name>
  <files>
    app/components/features/gta/GtaInterviewConsole.vue
  </files>
  <action>
    1. Create `app/components/features/gta/GtaInterviewConsole.vue`:
       - Props: `courseId: string`, `courseTitle?: string | null`, `courseCode?: string | null`, `interviewLocation?: string | null`.
       - Uses `useGtaInterviewConsole(props.courseId)`.
       - Header banner: Shows course name, interview meeting location (with copy button if Zoom link), on-duty status, and refresh button.
       - **Active Interview Panel (Hero Card)** (when `activeInterview` exists):
         - Student name, email, assignment title, time checked in.
         - 10-minute visual progress/timer or elapsed duration indicator.
         - Observation/grading notes textarea with "Save Notes" button and autosave feedback.
         - "Complete & Check Out" primary button (sets status to `COMPLETED` / `CHECKED_OUT`).
       - **Expected Arrivals Section**:
         - List of scheduled appointments (`expectedArrivals`) ordered by time.
         - For each card/row: student name, assignment, scheduled 10-min slot.
         - Actions: "Check In" button (triggers active interview mode) and "Mark No-Show" button (with confirmation modal / prompt, sets status to `MISSED`).
       - **Past / Completed Interviews Section**:
         - Collapsible or tabbed view showing appointments completed or marked missed during the shift.
         - Displays notes recorded, check-in and check-out timestamps, and status badges.
       - Empty states: Helpful illustrations/text when no interviews are scheduled or in progress.
  </action>
  <verify>test -f app/components/features/gta/GtaInterviewConsole.vue</verify>
  <done>GtaInterviewConsole presents active interview controls, arrival queues, and note-taking interfaces.</done>
</task>

<task type="auto">
  <name>Create /interviews Page and Connect Navigation Links</name>
  <files>
    app/pages/interviews/index.vue,
    app/components/features/dashboard/Teacher.vue,
    app/layouts/default.vue
  </files>
  <action>
    1. Create `app/pages/interviews/index.vue`:
       - Fetch current enrollment using `useCurrentEnrollment`.
       - Check authorization (user must have role `TA`, `TEACHER`, `INSTRUCTOR`, or `ADMIN`).
       - Render `GtaInterviewConsole` with `courseId`, `courseTitle`, `courseCode`, and `interviewLocation`.
       - Add breadcrumb or back link to course dashboard.
    2. In `app/components/features/dashboard/Teacher.vue`:
       - Add an "Interview Console" action button in the header links alongside Course Settings and Student View.
    3. In `app/layouts/default.vue`:
       - Add a quick link icon for GTA interviews when user is a TA or instructor in the current course.
  </action>
  <verify>test -f app/pages/interviews/index.vue</verify>
  <done>GTAs and instructors can navigate directly to /interviews to manage their on-duty grading appointments.</done>
</task>

<task type="auto">
  <name>Unit Tests & Full Milestone Verification</name>
  <files>
    test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts,
    .gsd/phases/4/1-SUMMARY.md,
    .gsd/phases/4/2-SUMMARY.md,
    .gsd/phases/4/VERIFICATION.md
  </files>
  <action>
    1. Create `test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts`:
       - Verify rendering of Active Interview panel with notes and checkout button.
       - Verify rendering of Expected Arrivals list with Check In and Mark No-Show actions.
       - Verify interaction with `checkIn`, `checkOut`, `saveNotes`, and `markNoShow` composable methods.
    2. Run full regression unit test suite across entire project (`docker compose exec app-dev pnpm test:unit`).
    3. Run targeted ESLint on all new/modified files.
    4. Produce `1-SUMMARY.md`, `2-SUMMARY.md`, and `VERIFICATION.md`.
    5. Update `ROADMAP.md`, `STATE.md`, and `REQUIREMENTS.md` marking Milestone v5.0 complete.
  </action>
  <verify>docker compose exec app-dev pnpm test:unit test/unit/app/components/features/gta/GtaInterviewConsole.spec.ts</verify>
  <done>All GTA console components and integrations are tested and verified with zero errors and zero regressions.</done>
</task>

## Success Criteria

- GTAs can manage their shifts end-to-end: check in arriving students, record notes, check out, and mark no-shows.
- Seamless navigation between the teacher dashboard, student dashboard, and GTA interview console.
- 100% test pass rate across the full codebase.
