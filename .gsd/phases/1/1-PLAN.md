---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Database Schema, Migration & Shared Schemas for GTA Interviews

## Objective

Extend the Prisma database schema with models for course-scoped GTA interview scheduling, run the database migration inside Docker, and define the foundational Zod schemas and TypeScript interfaces in `shared/`.

## Context

- `.gsd/SPEC.md`
- `.gsd/REQUIREMENTS.md` (REQ-501)
- `prisma/schema.prisma`
- `shared/schemas/cbtf.schema.ts` (reference for time patterns & shift structures)

## Tasks

<task type="auto">
  <name>Update Prisma Schema with GTA Interview Models</name>
  <files>prisma/schema.prisma</files>
  <action>
    Add the following models, relations, and enums to `prisma/schema.prisma`:
    1. In `model Course`:
       - Add `interviewLocation String?`
       - Add `gtaShifts GtaShift[]`
    2. In `model Assignment`:
       - Add `hasInterviews Boolean @default(false)`
       - Add `interviewWindowStart DateTime?`
       - Add `interviewWindowEnd DateTime?`
       - Add `gtaInterviewReservations GtaInterviewReservation[]`
    3. In `model User`:
       - Add `gtaShifts GtaShift[]`
       - Add `gtaInterviewReservationsAsStudent GtaInterviewReservation[] @relation("StudentReservations")`
       - Add `gtaInterviewReservationsAsGta GtaInterviewReservation[] @relation("GtaReservations")`
    4. Add enum `GtaInterviewStatus`:
       - `SCHEDULED`
       - `CHECKED_IN`
       - `CHECKED_OUT`
       - `COMPLETED`
       - `MISSED`
       - `CANCELLED`
    5. Add `model GtaShift`:
       - `id String @id @default(cuid())`
       - `courseId String`
       - `course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)`
       - `userId String`
       - `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
       - `date DateTime`
       - `startTime String` (24h "HH:mm")
       - `endTime String` (24h "HH:mm")
       - `createdAt DateTime @default(now())`
       - `updatedAt DateTime @updatedAt`
       - Indexes on `[courseId, date]`, `[userId]`, `[courseId, userId]`
    6. Add `model GtaInterviewReservation`:
       - `id String @id @default(cuid())`
       - `assignmentId String`
       - `assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)`
       - `studentId String`
       - `student User @relation("StudentReservations", fields: [studentId], references: [id], onDelete: Cascade)`
       - `gtaId String`
       - `gta User @relation("GtaReservations", fields: [gtaId], references: [id], onDelete: Cascade)`
       - `startTime DateTime`
       - `endTime DateTime`
       - `status GtaInterviewStatus @default(SCHEDULED)`
       - `checkedInAt DateTime?`
       - `checkedOutAt DateTime?`
       - `notes String? @db.Text`
       - `createdAt DateTime @default(now())`
       - `updatedAt DateTime @updatedAt`
       - Indexes on `[assignmentId, studentId]`, `[gtaId, startTime]`, `[assignmentId, startTime]`, `[status, startTime]`
  </action>
  <verify>grep -q "model GtaShift" prisma/schema.prisma && grep -q "model GtaInterviewReservation" prisma/schema.prisma</verify>
  <done>Prisma schema contains all requested GTA interview fields, models, enums, relations, and indexes with zero syntax errors.</done>
</task>

<task type="auto">
  <name>Execute Prisma Migration & Client Generation</name>
  <files>prisma/schema.prisma, prisma/migrations/</files>
  <action>
    Run the Prisma migration within the `app-dev` container:
    `docker compose exec app-dev pnpm prisma migrate dev --name add_gta_interview_models`
    Verify that the migration applies cleanly and Prisma Client is regenerated.
  </action>
  <verify>docker compose exec app-dev pnpm prisma validate</verify>
  <done>Migration files created in prisma/migrations and applied to PostgreSQL, and Prisma client generated successfully.</done>
</task>

<task type="auto">
  <name>Define Shared Zod Schemas & TypeScript Contracts</name>
  <files>shared/schemas/gta-interview.schema.ts, test/unit/shared/schemas/gta-interview.schema.test.ts</files>
  <action>
    Create `shared/schemas/gta-interview.schema.ts`:
    1. Time format regex (`cbtfTimeRegex`).
    2. `createGtaShiftInputSchema`: `courseId`, `userId`, `date` (YYYY-MM-DD), `startTime` ("HH:mm"), `endTime` ("HH:mm"), validating `endTime > startTime`.
    3. `updateGtaShiftInputSchema`: `date`, `startTime`, `endTime`, `userId` (all optional).
    4. `gtaBatchShiftSlotSchema`: `dayOfWeek` (0..6), `startTime`, `endTime`.
    5. `gtaBatchGenerateShiftsSchema`: `courseId`, `userId`, `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD), `shifts` array.
    6. `gtaInterviewReservationStatusSchema`: Zod native enum or enum matching `GtaInterviewStatus`.
    7. `createGtaInterviewReservationInputSchema`: `assignmentId`, `startTime` (ISO datetime).
    8. `updateGtaInterviewReservationInputSchema`: `status`, `notes`.
    9. Export inferred TypeScript types for all schemas.
    Create comprehensive Vitest unit tests in `test/unit/shared/schemas/gta-interview.schema.test.ts` verifying valid inputs, invalid time formats, inverted start/end times, and boundary edge cases.
  </action>
  <verify>docker compose exec app-dev pnpm run test:unit test/unit/shared/schemas/gta-interview.schema.test.ts</verify>
  <done>Zod schemas accurately enforce data contracts and unit tests pass with 100% coverage.</done>
</task>

## Success Criteria

- [ ] `prisma/schema.prisma` reflects GTA interview models, enums, and relations without warnings.
- [ ] Database migration `add_gta_interview_models` successfully executed in PostgreSQL.
- [ ] `shared/schemas/gta-interview.schema.ts` defines complete input and projection schemas.
- [ ] Schema unit tests pass cleanly inside Docker.
