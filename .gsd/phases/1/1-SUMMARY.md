# Plan 1.1 Summary: Database Schema, Migration & Shared Schemas for GTA Interviews

## Delivered Work

1. **Prisma Schema Updates**:
   - Added `interviewLocation String?` and `gtaShifts GtaShift[]` to `Course`.
   - Added `hasInterviews Boolean @default(false)`, `interviewWindowStart DateTime?`, `interviewWindowEnd DateTime?`, and `gtaInterviewReservations GtaInterviewReservation[]` to `Assignment`.
   - Added relations on `User` for `gtaShifts`, `gtaInterviewReservationsAsStudent`, and `gtaInterviewReservationsAsGta`.
   - Added enum `GtaInterviewStatus` (`SCHEDULED`, `CHECKED_IN`, `CHECKED_OUT`, `COMPLETED`, `MISSED`, `CANCELLED`).
   - Added model `GtaShift` with indexes on `[courseId, date]`, `[userId]`, and `[courseId, userId]`.
   - Added model `GtaInterviewReservation` with indexes on `[assignmentId, studentId]`, `[gtaId, startTime]`, `[assignmentId, startTime]`, and `[status, startTime]`.
2. **Database Migration**:
   - Successfully executed migration `20260916022714_add_gta_interview_models` on PostgreSQL inside Docker.
   - Generated updated Prisma client.
3. **Shared Schemas & TypeScript Contracts**:
   - Implemented `shared/schemas/gta-interview.schema.ts` defining input schemas for single shift creation, partial update, batch generation, interview booking, status update, notes, and course interview location.
   - Added comprehensive unit tests in `test/unit/shared/schemas/gta-interview.schema.test.ts` (15/15 tests passing).
   - ESLint and formatting verified clean.

## Verification

- `docker compose exec app-dev pnpm prisma validate`: Passed (schema valid).
- `docker compose exec app-dev pnpm run test:unit test/unit/shared/schemas/gta-interview.schema.test.ts`: Passed (15/15 tests passed).
- `docker compose exec app-dev pnpm eslint shared/schemas/gta-interview.schema.ts test/unit/shared/schemas/gta-interview.schema.test.ts`: Clean (0 errors, 0 warnings).
