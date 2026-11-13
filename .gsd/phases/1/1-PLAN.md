---
phase: 1
plan: 1
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - shared/schemas/assignment-notice.schema.ts
  - test/unit/shared/schemas/assignment-notice.schema.test.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - 'StudentAssignmentNotice Prisma model is defined with assignmentId, studentId, notice (Text), authorId (User?), createdAt, updatedAt'
    - 'Unique constraint @@unique([assignmentId, studentId]) is enforced at database level'
    - 'Prisma migration executes cleanly inside Docker'
    - 'Zod schemas in shared/schemas/assignment-notice.schema.ts validate DTOs and batch upload payload'
    - 'Unit tests in test/unit/shared/schemas/assignment-notice.schema.test.ts pass 100%'
  artifacts:
    - 'prisma/schema.prisma'
    - 'shared/schemas/assignment-notice.schema.ts'
    - 'test/unit/shared/schemas/assignment-notice.schema.test.ts'
  key_links:
    - 'shared/schemas/assignment-notice.schema.ts'
---

# Plan 1.1: Data Model, Migration & Shared Schemas for StudentAssignmentNotice

<objective>
Implement the database foundation for uploaded staff notices. Add the `StudentAssignmentNotice` model to `prisma/schema.prisma` with reciprocal relations on `Assignment` and `User`. Execute the Prisma migration within the Docker environment (`app-dev`). Define Zod schemas and TypeScript interfaces in `shared/schemas/assignment-notice.schema.ts` for DTOs and batch upsert payloads, and verify contracts with comprehensive Vitest tests.

Purpose: Creates the persistent storage and validation contracts for staff-uploaded grading notices.
Output: Applied Prisma migration, updated schema, shared Zod schemas, and unit test suite.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- .gsd/REQUIREMENTS.md
- .gsd/DECISIONS.md
- prisma/schema.prisma
- shared/schemas/gta-interview.schema.ts
</context>

<tasks>

<task type="auto">
  <name>Add StudentAssignmentNotice to Prisma schema and run migration</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    1. In `prisma/schema.prisma`, add `StudentAssignmentNotice` model:
       - `id`: String @id @default(cuid())
       - `assignment`: Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
       - `assignmentId`: String
       - `student`: User @relation("StudentAssignmentNotices", fields: [studentId], references: [id], onDelete: Cascade)
       - `studentId`: String
       - `notice`: String @db.Text
       - `author`: User? @relation("AuthoredAssignmentNotices", fields: [authorId], references: [id], onDelete: SetNull)
       - `authorId`: String?
       - `createdAt`: DateTime @default(now())
       - `updatedAt`: DateTime @updatedAt
       - @@unique([assignmentId, studentId])
       - @@index([assignmentId])
       - @@index([studentId])
    2. Add reciprocal relation fields:
       - On `Assignment`: `studentAssignmentNotices StudentAssignmentNotice[]`
       - On `User`: `studentAssignmentNotices StudentAssignmentNotice[] @relation("StudentAssignmentNotices")`
       - On `User`: `authoredAssignmentNotices StudentAssignmentNotice[] @relation("AuthoredAssignmentNotices")`
    3. Run migration inside Docker: `docker compose exec app-dev pnpm prisma migrate dev --name add_student_assignment_notice`.
  </action>
  <verify>
    `docker compose exec app-dev pnpm prisma status`
  </verify>
  <done>
    Prisma migration created and applied; Prisma client generated with `StudentAssignmentNotice`.
  </done>
</task>

<task type="auto">
  <name>Create shared Zod schemas and unit test suite</name>
  <files>
    shared/schemas/assignment-notice.schema.ts
    test/unit/shared/schemas/assignment-notice.schema.test.ts
  </files>
  <action>
    1. Create `shared/schemas/assignment-notice.schema.ts`:
       - `studentAssignmentNoticeDtoSchema`: validates output projection (`id`, `assignmentId`, `studentId`, `notice`, `authorId`, `authorName`, `createdAt`, `updatedAt`).
       - `batchUpsertNoticeItemSchema`: validates an individual item `{ studentIdentifier: z.string().min(1), notice: z.string().min(1) }` where `studentIdentifier` is email or studentId.
       - `batchUpsertStudentAssignmentNoticesSchema`: validates `{ notices: z.array(batchUpsertNoticeItemSchema).min(1).max(500) }`.
       - `singleUpsertStudentAssignmentNoticeSchema`: validates `{ notice: z.string().min(1) }`.
    2. Create `test/unit/shared/schemas/assignment-notice.schema.test.ts` to verify schema validation rules and edge cases.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/shared/schemas/assignment-notice.schema.test.ts`
  </verify>
  <done>
    All schema contracts tested and passing.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Database schema includes `StudentAssignmentNotice` table.
- [ ] Migration applied cleanly with zero errors.
- [ ] Zod schema test suite passes 100%.
</verification>

<success_criteria>
All Phase 1 requirements (REQ-801, REQ-802) verified with empirical proof.
</success_criteria>
