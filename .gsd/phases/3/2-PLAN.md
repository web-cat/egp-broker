---
phase: 3
plan: 2
wave: 2
---

# Plan 3.2: Student Interview Scheduling UI & Dashboard Integration

## Objective

Build the student-facing interview scheduling experience: a specialized composable (`useGtaInterviewStudent.ts`), a modal wizard (`GtaInterviewScheduleModal.vue`) mirroring CBTF's progressive narrowing design with 10-minute slot selection, active/completed interview status display, and assignment action buttons in `useStudentDashboard.ts` and `Student.vue`.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-511)
- `app/components/features/cbtf/CbtfScheduleModal.vue`
- `app/composables/features/useStudentDashboard.ts`
- `app/components/features/dashboard/Student.vue`
- `server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots.get.ts`
- `server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/`

## Tasks

<task type="auto">
  <name>Create useGtaInterviewStudent Composable and Schedule Modal</name>
  <files>
    app/composables/features/useGtaInterviewStudent.ts,
    app/components/features/gta/GtaInterviewScheduleModal.vue
  </files>
  <action>
    1. Create `app/composables/features/useGtaInterviewStudent.ts`:
       - Accepts `courseId: Ref<string> | string` and `assignmentId: Ref<string> | string`.
       - Manages reactive state for:
         - `slotsData` (`useFetch` to `/api/me/courses/[courseId]/assignments/[assignmentId]/interview-slots`).
         - `myReservation` (`useFetch` to `/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/my`).
         - `bookSlot(startTime: string)`: posts to reservations endpoint, displays success toast with assigned GTA and location.
         - `cancelReservation(id: string)`: calls delete endpoint, refreshes slot and reservation state.
    2. Create `app/components/features/gta/GtaInterviewScheduleModal.vue`:
       - Mode A: Active / Missed / Completed Reservation View:
         - Displays assigned GTA name, email, scheduled time, and meeting location (`interviewLocation`).
         - Shows status badge (`SCHEDULED`, `CHECKED_IN`, `COMPLETED`, `MISSED`).
         - If `SCHEDULED`: provides "Cancel Reservation" button.
         - If `MISSED` or `COMPLETED` or `CANCELLED`: provides "Reschedule Interview" button.
       - Mode B: 3-step narrowing wizard:
         - Step 1: Half-Day Block Selection (Morning / Afternoon cards showing date, open capacity, and interview location).
         - Step 2: 10-Minute Timeslot Selection (interactive chips/buttons for each 10-minute slot, showing remaining capacity).
         - Step 3: Review & Confirm (summary of selected date & time, assignment name, notice that a Graduate TA will be automatically assigned upon confirmation, "Confirm Interview Booking" button).
  </action>
  <verify>test -f app/components/features/gta/GtaInterviewScheduleModal.vue</verify>
  <done>Student can browse open half-day blocks, pick a 10-minute interview slot, confirm booking, and view or cancel active reservations.</done>
</task>

<task type="auto">
  <name>Integrate Interview Column and Card into Student Dashboard</name>
  <files>
    app/composables/features/useStudentDashboard.ts,
    app/components/features/dashboard/Student.vue
  </files>
  <action>
    1. In `app/composables/features/useStudentDashboard.ts`:
       - Add state for `showGtaInterviewModal: ref(false)` and `selectedGtaInterviewAssignment: ref<AssignmentRow | null>(null)`.
       - In `assignmentColumns`:
         - Add an "Interview" column for assignments with `hasInterviews = true`:
           - If no reservation: "Schedule Interview" button (outline style with `i-lucide-calendar-plus`).
           - If `SCHEDULED`: badge showing date/time with `i-lucide-calendar-check` (clickable to view details/cancel).
           - If `CHECKED_IN`: "In Interview" badge (`i-lucide-user-check`).
           - If `COMPLETED` or `CHECKED_OUT`: "Completed" badge (`i-lucide-badge-check`).
           - If `MISSED`: "Missed (Reschedule)" button (`i-lucide-alert-circle`).
    2. In `app/components/features/dashboard/Student.vue`:
       - Mount `FeaturesGtaGtaInterviewScheduleModal`:
         - Bound to `showGtaInterviewModal` and `selectedGtaInterviewAssignment`.
       - Add an "Upcoming GTA Interview" card in the top stats section when an active scheduled reservation exists.
  </action>
  <verify>grep -q "GtaInterviewScheduleModal" app/components/features/dashboard/Student.vue</verify>
  <done>Student dashboard prominently features grading interview scheduling, upcoming reservation cards, and clear completion indicators.</done>
</task>

<task type="auto">
  <name>Unit Tests for Student Interview Composable and Modal</name>
  <files>
    test/unit/app/composables/useGtaInterviewStudent.spec.ts,
    test/unit/app/components/features/gta/GtaInterviewScheduleModal.spec.ts
  </files>
  <action>
    1. Create `test/unit/app/composables/useGtaInterviewStudent.spec.ts`:
       - Tests fetching slots and reservation for an assignment.
       - Tests booking a slot (calls POST, updates state, handles errors).
       - Tests cancelling a reservation (calls DELETE, updates state).
    2. Create `test/unit/app/components/features/gta/GtaInterviewScheduleModal.spec.ts`:
       - Tests Mode A: renders current reservation with assigned GTA and location.
       - Tests Mode B: renders stepper with half-day blocks and slot selection.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/app/composables/useGtaInterviewStudent.spec.ts test/unit/app/components/features/gta/GtaInterviewScheduleModal.spec.ts</verify>
  <done>Student composable and schedule modal have 100% behavioral test coverage.</done>
</task>

## Success Criteria

- Students can schedule, review, and cancel GTA grading interviews directly from the dashboard.
- Progressive narrowing wizard mirrors CBTF usability with 10-minute granularity.
- All unit tests pass with clean ESLint checks.
