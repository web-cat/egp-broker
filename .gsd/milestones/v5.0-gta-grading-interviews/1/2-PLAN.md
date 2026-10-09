---
phase: 1
plan: 2
wave: 2
---

# Plan 1.2: Course-Scoped GTA Shift Management Endpoints & Permissions

## Objective

Implement the course-scoped GTA shift management backend endpoints (`GET`, `POST`, `PATCH`, `DELETE`, and `POST /batch`) with strict authorization rules ensuring course instructors can manage shifts for any GTA in their course, and GTAs (`CourseRole.TA`) can manage their own shifts.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-502, REQ-503)
- `shared/schemas/gta-interview.schema.ts`
- `server/api/admin/cbtf/shifts/` (reference implementation for shift handling)
- `server/utils/teacher.ts` (reference for course permission validation)

## Tasks

<task type="auto">
  <name>Implement Course Authorization & GTA Role Helper</name>
  <files>server/utils/gta-interview.ts</files>
  <action>
    Create `server/utils/gta-interview.ts` containing helper functions:
    1. `assertCourseInstructorOrSelfGta(event, courseId, targetUserId?)`:
       - Retrieves user session via `getUserSession(event)`.
       - Throws 401 if not authenticated.
       - Checks user's enrollment in `courseId`.
       - If user is Global ADMIN or enrolled as `CourseRole.TEACHER` or `CourseRole.ADMIN` in the course: allowed for any `targetUserId` (as long as `targetUserId` is enrolled with `CourseRole.TA` in the course).
       - If user is enrolled as `CourseRole.TA`: allowed ONLY if `targetUserId` matches their own `user.id`.
       - Otherwise throws 403 Forbidden.
    2. `assertUserIsCourseGta(courseId, userId)`:
       - Confirms `userId` is enrolled in `courseId` with `role: CourseRole.TA`.
       - Throws 400 Bad Request if the user is not a TA in this course.
  </action>
  <verify>test -f server/utils/gta-interview.ts</verify>
  <done>Authorization helper cleanly handles instructor, admin, and self-GTA checks with strict course scoping.</done>
</task>

<task type="auto">
  <name>Implement Course GTA Shift CRUD Endpoints</name>
  <files>
    server/api/me/courses/[courseId]/gta-shifts/index.get.ts,
    server/api/me/courses/[courseId]/gta-shifts/index.post.ts,
    server/api/me/courses/[courseId]/gta-shifts/[id].patch.ts,
    server/api/me/courses/[courseId]/gta-shifts/[id].delete.ts
  </files>
  <action>
    Build the RESTful endpoints under `server/api/me/courses/[courseId]/gta-shifts/`:
    1. `index.get.ts`:
       - Validate course membership (Instructor, TA, or Student).
       - Query params: optional `gtaId`, optional `startDate`, optional `endDate`.
       - Returns shifts ordered by `[{ date: 'asc' }, { startTime: 'asc' }]` with selected user info (`id`, `firstName`, `lastName`, `email`, `avatarUrl`).
    2. `index.post.ts`:
       - Validate body with `createGtaShiftInputSchema`.
       - Authorize using `assertCourseInstructorOrSelfGta`.
       - Validate target `userId` is enrolled as `CourseRole.TA` in `courseId`.
       - Create `GtaShift` with `{ courseId, userId, date: shiftDate, startTime, endTime }`.
    3. `[id].patch.ts`:
       - Validate body with `updateGtaShiftInputSchema`.
       - Find existing shift; verify it belongs to `courseId`.
       - Authorize instructor or owning GTA.
       - If `userId` reassignment requested, verify new user is a course TA.
       - Update `GtaShift`.
    4. `[id].delete.ts`:
       - Find existing shift; verify it belongs to `courseId`.
       - Authorize instructor or owning GTA.
       - Delete `GtaShift`.
  </action>
  <verify>test -f server/api/me/courses/[courseId]/gta-shifts/index.get.ts && test -f server/api/me/courses/[courseId]/gta-shifts/index.post.ts</verify>
  <done>All 4 GTA shift CRUD endpoints validate Zod inputs, enforce role permissions, and return projected responses.</done>
</task>

<task type="auto">
  <name>Implement Batch Shift Generation Endpoint & Unit Tests</name>
  <files>
    server/api/me/courses/[courseId]/gta-shifts/batch.post.ts,
    test/unit/server/api/gta-shifts.test.ts
  </files>
  <action>
    1. Implement `batch.post.ts`:
       - Validate body using `gtaBatchGenerateShiftsSchema`.
       - Authorize caller (Instructor or self-GTA).
       - Validate `userId` has `CourseRole.TA` in `courseId`.
       - Iterate day-by-day from `startDate` to `endDate` using UTC date math.
       - Match `dayOfWeek` against slots.
       - Insert shifts via `prisma.gtaShift.createMany` or transaction.
       - Return `{ count, shifts }`.
    2. Create `test/unit/server/api/gta-shifts.test.ts`:
       - Test instructor can create shift for a course TA.
       - Test instructor cannot create shift for non-TA student.
       - Test GTA can create and batch-generate shifts for themselves.
       - Test GTA cannot create or edit shifts for another GTA.
       - Test student cannot create, edit, or delete shifts.
       - Test batch generation correctly generates shifts across arbitrary date boundaries.
       - Test update and delete functionality.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/server/api/gta-shifts.test.ts</verify>
  <done>Batch generation endpoint functions correctly and all unit tests in test/unit/server/api/gta-shifts.test.ts pass.</done>
</task>

## Success Criteria

- [ ] All course-scoped GTA shift endpoints (`GET`, `POST`, `PATCH`, `DELETE`, `POST /batch`) are fully implemented.
- [ ] Instructors can manage all GTA shifts in their courses; GTAs can manage their own shifts; unauthorized actions return 403.
- [ ] Only users enrolled with role `TA` can be scheduled for GTA shifts.
- [ ] Vitest unit test suite passes with 100% coverage.
