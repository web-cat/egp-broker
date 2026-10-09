---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Course & Assignment Teacher Settings for GTA Interviews

## Objective

Implement the teacher-facing configuration options for GTA grading interviews: allow instructors to configure the course-level `interviewLocation` (room number, Zoom URL, etc.) and configure assignment-level interview requirements (`hasInterviews`, `interviewWindowStart`, `interviewWindowEnd`) with full schema, API, and UI integration.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-510)
- `shared/models/assignment.ts`
- `shared/models/enrollment.ts`
- `server/api/me/assignments/[id].patch.ts`
- `server/api/me/assignments/index.post.ts`
- `app/components/features/admin/AssignmentEditPanel.vue`
- `app/components/features/dashboard/Teacher.vue`

## Tasks

<task type="auto">
  <name>Extend Assignment & Course Schemas and Server Endpoints</name>
  <files>
    shared/models/assignment.ts,
    shared/models/enrollment.ts,
    server/utils/enrollments.ts,
    server/api/me/assignments/[id].patch.ts,
    server/api/me/assignments/index.post.ts,
    server/api/me/courses/[courseId]/index.patch.ts
  </files>
  <action>
    1. In `shared/models/assignment.ts`:
       - Add `hasInterviews?: boolean`, `interviewWindowStart?: string | null`, `interviewWindowEnd?: string | null` to `AssignmentRow`.
       - Add `hasInterviews`, `interviewWindowStart`, `interviewWindowEnd` to `createAssignmentSchema` and `updateAssignmentSchema`.
       - Add defaults to `initialAssignmentState` (`hasInterviews: false`, `interviewWindowStart: null`, `interviewWindowEnd: null`).
    2. In `shared/models/enrollment.ts`:
       - Add `interviewLocation?: string | null` to `SimpleEnrollment` and populate it in `toSimpleEnrollment`.
    3. In `server/api/me/assignments/[id].patch.ts` and `server/api/me/assignments/index.post.ts`:
       - Read and persist `hasInterviews`, `interviewWindowStart`, `interviewWindowEnd`.
    4. Create `server/api/me/courses/[courseId]/index.patch.ts`:
       - Validate course membership and verify caller is an instructor/teacher in `courseId`.
       - Accept `{ interviewLocation: string | null }`.
       - Update `Course.interviewLocation` in Prisma and return updated course data.
  </action>
  <verify>grep -q "interviewLocation" server/api/me/courses/\[courseId\]/index.patch.ts</verify>
  <done>Course interviewLocation and assignment interview settings are validated, saved, and returned via API.</done>
</task>

<task type="auto">
  <name>Add GTA Interview Options to AssignmentEditPanel and Teacher Dashboard</name>
  <files>
    app/components/features/admin/AssignmentEditPanel.vue,
    app/components/features/dashboard/Teacher.vue,
    app/components/features/course/CourseSettingsModal.vue
  </files>
  <action>
    1. In `app/components/features/admin/AssignmentEditPanel.vue`:
       - Add a "GTA Grading Interview Options" section alongside CBTF options.
       - Include `USwitch` for "Require Graduate TA Grading Interview" (`state.hasInterviews`).
       - If `state.hasInterviews` is true, show date-time inputs for `interviewWindowStart` and `interviewWindowEnd`.
       - Bind state and format values correctly during save/edit.
    2. Create `app/components/features/course/CourseSettingsModal.vue`:
       - Modal for editing course-level settings, specifically the default `interviewLocation` (e.g., "McBryde Hall 106", "https://virginiatech.zoom.us/j/...").
       - Emits updated course settings and provides a toast upon save.
    3. In `app/components/features/dashboard/Teacher.vue`:
       - Add a "Course Settings" button or card in the header/toolbar linking to `CourseSettingsModal`.
       - Display the current `interviewLocation` badge or summary if configured.
  </action>
  <verify>test -f app/components/features/course/CourseSettingsModal.vue</verify>
  <done>Instructors can set the course interview location and toggle GTA interviews per assignment with custom scheduling windows.</done>
</task>

<task type="auto">
  <name>Unit Tests for Teacher Course Settings & Assignment Interview Options</name>
  <files>
    test/unit/server/api/teacher-course-settings.test.ts,
    test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts
  </files>
  <action>
    1. Create `test/unit/server/api/teacher-course-settings.test.ts`:
       - Tests `PATCH /api/me/courses/[courseId]`:
         - Rejects non-teachers with 403.
         - Updates `interviewLocation` and returns updated course record.
       - Tests `PATCH /api/me/assignments/[id]` with `hasInterviews`, `interviewWindowStart`, `interviewWindowEnd`.
    2. Update `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts`:
       - Verify rendering of GTA interview switch and interview window start/end fields.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/server/api/teacher-course-settings.test.ts</verify>
  <done>Teacher course settings and assignment interview options are verified by passing unit tests.</done>
</task>

## Success Criteria

- Instructors can view and update course `interviewLocation`.
- Instructors can toggle `hasInterviews` on assignments and set an interview window.
- All unit tests pass with clean ESLint and zero regressions.
