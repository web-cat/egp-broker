---
phase: 3
plan: 2
wave: 2
---

# Plan 3.2: Student Scheduling Experience UI & Duration-Aware Slot Presentation

## Objective

Update the student scheduling modal and composable (`useCbtfStudent.ts`, `CbtfScheduleModal.vue`) to dynamically reflect the assignment duration (30 min vs 60 min), updating badges, modal copy, arrival buffer advice, and time range previews. Add component unit tests.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [app/composables/features/useCbtfStudent.ts](file:///Users/edwards/git/egp-broker/app/composables/features/useCbtfStudent.ts)
- [app/components/features/cbtf/CbtfScheduleModal.vue](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfScheduleModal.vue)
- [shared/models/cbtf.ts](file:///Users/edwards/git/egp-broker/shared/models/cbtf.ts)

## Tasks

<task type="auto">
  <name>Update CbtfScheduleModal and useCbtfStudent for Dynamic Assignment Duration</name>
  <files>app/composables/features/useCbtfStudent.ts,app/components/features/cbtf/CbtfScheduleModal.vue</files>
  <action>
    1. In `app/composables/features/useCbtfStudent.ts`:
       - Add `cbtfDurationMinutes?: number` to `CbtfAvailabilityData` interface.
    2. In `app/components/features/cbtf/CbtfScheduleModal.vue`:
       - Add a computed `durationMinutes = computed(() => availabilityData.value?.cbtfDurationMinutes || props.assignment?.cbtfDurationMinutes || 60)`.
       - Update Step 3 Summary badge:
         Replace hardcoded "60 Minutes Duration" with `{{ durationMinutes }} Minutes Duration`.
       - Update modal descriptions and labels to reflect dynamic duration:
         - When `durationMinutes === 30`: indicate "30-Minute Quiz Reservation".
         - When `durationMinutes === 60`: indicate "60-Minute Exam Reservation".
       - In Step 2 arrival slot picker, ensure that selected slot display and preview note the duration interval ($[startTime, endTime)$).
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts</verify>
  <done>Student scheduling modal dynamically renders 30-minute and 60-minute duration badges, descriptions, and summaries.</done>
</task>

<task type="auto">
  <name>Add Unit Tests for Student Scheduling Modal Dynamic Duration</name>
  <files>test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts</files>
  <action>
    1. Create or extend `test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts`:
       - Test that when `availabilityData.cbtfDurationMinutes = 30`, Step 3 displays "30 Minutes Duration".
       - Test that when `availabilityData.cbtfDurationMinutes = 60`, Step 3 displays "60 Minutes Duration".
       - Test that rescheduling retains and displays the appropriate duration.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts</verify>
  <done>CbtfScheduleModal component tests pass with 100% coverage for duration rendering.</done>
</task>

## Success Criteria

- [ ] `useCbtfStudent.ts` types include `cbtfDurationMinutes`.
- [ ] `CbtfScheduleModal.vue` dynamically displays 30m vs 60m badges and summaries based on assignment duration.
- [ ] Component unit tests pass in Docker.
