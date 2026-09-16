# Plan 3.1 Summary: Course & Assignment Teacher Settings for GTA Interviews

## Delivered Work

1. **Schema & Model Extensions**:
   - Extended `shared/models/assignment.ts`: added `hasInterviews`, `interviewWindowStart`, and `interviewWindowEnd` to `AssignmentRow`, `createAssignmentSchema`, `updateAssignmentSchema`, and `initialAssignmentState`.
   - Extended `shared/models/enrollment.ts`: added `interviewLocation` to `SimpleEnrollment` and updated `toSimpleEnrollment`.
   - Extended `shared/schemas/course.schema.ts`: added `updateCourseSettingsSchema` with validation for `interviewLocation`.
   - Updated `server/utils/assignments.ts`: projected `hasInterviews` and interview window dates in `getAssignmentsForCourse`, and stored them in `createAssignment`.
   - Updated `server/api/me/assignments/[id].patch.ts`: added explicit `h3` imports and persisted `hasInterviews`, `interviewWindowStart`, and `interviewWindowEnd`.

2. **Course Settings Endpoint & Teacher Dashboard UI**:
   - Created `server/api/me/courses/[courseId]/index.patch.ts`: allows course instructors (`TEACHER` or `ADMIN`) to configure or clear `Course.interviewLocation`.
   - Created `app/components/features/course/CourseSettingsModal.vue`: modal interface for setting the default physical room or Zoom URL for GTA interviews.
   - Updated `app/components/features/dashboard/Teacher.vue`: added Course Settings button to header links, GTA interview location banner, and integrated `CourseSettingsModal`.
   - Updated `app/pages/index.vue`: passed `courseId` and `interviewLocation` props from current enrollment to `Teacher.vue`.
   - Updated `app/components/features/admin/AssignmentEditPanel.vue`: added "Graduate TA Grading Interview Options" switch (`hasInterviews`) and window start/end datetime inputs alongside CBTF options.

3. **Automated Unit Tests**:
   - `test/unit/server/api/teacher-course-settings.test.ts`: 6/6 tests passing (401 unauthenticated, 403 non-enrolled, 403 student role, 200 instructor update, 200 clearing location, 200 assignment interview settings patch).
   - `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts`: 2/2 tests passing (populating GTA interview fields and submitting updated payload).
   - Targeted ESLint: Clean (0 errors, 0 warnings).

## Verification

- `docker compose exec app-dev pnpm test:unit test/unit/server/api/teacher-course-settings.test.ts test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts`: Passed (8/8 tests).
- Targeted ESLint: Passed (0 errors, 0 warnings).
