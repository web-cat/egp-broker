# Plan 1.2 Summary: Course-Scoped GTA Shift Management Endpoints & Permissions

## Delivered Work

1. **Course Authorization Helper (`server/utils/gta-interview.ts`)**:
   - `assertCourseMember`: validates authenticated course membership (supports instructors, TAs, students, and global admins).
   - `assertUserIsCourseGta`: ensures target user is enrolled as `CourseRole.TA` in the course.
   - `assertCourseInstructorOrSelfGta`: enforces strict course permissions (instructors can manage all course TAs; TAs can only manage their own shifts; unauthorized callers receive 403).
2. **GTA Shift CRUD Endpoints**:
   - `GET /api/me/courses/[courseId]/gta-shifts`: returns course shifts ordered chronologically (`[{ date: 'asc' }, { startTime: 'asc' }]`) with user projections, filterable by `gtaId` and date range.
   - `POST /api/me/courses/[courseId]/gta-shifts`: creates single shift for an enrolled course TA.
   - `PATCH /api/me/courses/[courseId]/gta-shifts/[id]`: updates shift times/date/assigned TA with course scope verification.
   - `DELETE /api/me/courses/[courseId]/gta-shifts/[id]`: removes shift with authorization checks.
3. **Batch Generation Endpoint**:
   - `POST /api/me/courses/[courseId]/gta-shifts/batch`: batch-generates recurring weekly disconnected shifts across start/end dates matching day-of-week slots in a single atomic transaction.
4. **Unit Test Suite**:
   - Implemented `test/unit/server/api/gta-shifts.test.ts` (13/13 tests passing) covering all permissions, role checks, and error cases.
   - ESLint verified clean with 0 warnings.

## Verification

- `docker compose exec app-dev pnpm run test:unit test/unit/server/api/gta-shifts.test.ts`: Passed (13/13 tests passed).
- `docker compose exec app-dev pnpm eslint server/utils/gta-interview.ts server/api/me/courses/[courseId]/gta-shifts/ test/unit/server/api/gta-shifts.test.ts`: Clean (0 errors, 0 warnings).
