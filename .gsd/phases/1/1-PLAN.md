---
phase: 1
plan: 1
wave: 1
gap_closure: false
---

# Plan 1.1: Database Schema Migration & Universal Shared Models

## Objective

Extend the database schema and shared contracts to establish the data foundation for PassPort Protocol v1.2 status queries and submission caching. This adds `passportStatusUrl` to `LtiTool`, adds `submissionStatus` (Json) and `submissionStatusCheckedAt` (DateTime) to `GtaInterviewReservation`, applies the Prisma migration, updates shared Zod schemas (`passport.ts`, `tool.ts`), and aligns projection logic in `server/utils/lti-tools.ts`.

## Context

- `.gsd/SPEC.md`
- `.gsd/DECISIONS.md` (DECISION-019)
- `extension-api.v1.2.md`
- `prisma/schema.prisma`
- `shared/models/passport.ts`
- `shared/models/tool.ts`
- `server/utils/lti-tools.ts`

## Tasks

<task type="auto">
  <name>Add PassPort status fields to Prisma schema and execute migration</name>
  <files>
    prisma/schema.prisma
  </files>
  <action>
    1. In `prisma/schema.prisma`:
       - Under `model LtiTool`: Add `passportStatusUrl String?` in the PassPort credentials & endpoints block.
       - Under `model GtaInterviewReservation`: Add:
         - `submissionStatus Json?`
         - `submissionStatusCheckedAt DateTime?`
    2. Run migration via Docker:
       `docker compose exec app-dev pnpm prisma migrate dev --name add_passport_v12_status_fields`
    3. Generate Prisma client:
       `docker compose exec app-dev pnpm prisma generate`
    
    AVOID: Using `prisma db push` (prohibited by GEMINI.md Section III).
    USE: `prisma migrate dev` with a descriptive name.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/server/api/admin/cbtf-reservations.test.ts`
  </verify>
  <done>
    Prisma migration created under `prisma/migrations/`, Prisma client regenerated with new types, and database tests pass.
  </done>
</task>

<task type="auto">
  <name>Update shared models, Zod validation schemas, and tool projection helpers</name>
  <files>
    shared/models/passport.ts
    shared/models/tool.ts
    server/utils/lti-tools.ts
    test/unit/shared/schemas/tool.schema.test.ts
  </files>
  <action>
    1. In `shared/models/passport.ts`:
       - Update `passPortPhase1RequestSchema`: expand `passport_version` to `z.enum(['1.0', '1.1', '1.2'])`.
       - Update `passPortPhase2CredentialsSchema`:
         - Expand `passport_version` to `z.enum(['1.0', '1.1', '1.2'])`.
         - In `endpoints`, add `status_handler: z.string().url('status_handler must be a valid URL').optional()`.
       - Add submission status schemas from PassPort v1.2:
         - `passPortSubmissionItemSchema`: `timestamp`, `submission_number`, `submit_number`, `total_score`, `ta_score`, `staff_notice`, `feedback_url`, `view_url`, `student_view_url`, `direct_url_feedback`, `grading_url`, `edit_url`, `grader_view_url`, `direct_url_grading`.
         - `passPortStatusResponseSchema`: `status: z.literal('ok')`, `submission_for_grading: passPortSubmissionItemSchema.nullable()`, `most_recent_submission: passPortSubmissionItemSchema.nullable().optional()`.
         - `cachedSubmissionStatusSchema`: structured representation stored in `GtaInterviewReservation.submissionStatus`.
       - Add `normalizePassPortStatusUrl(url: string): string` helper matching Apple WebObjects patterns if needed.
    2. In `shared/models/tool.ts`:
       - Update `toolRowSchema`: add `passportStatusUrl: z.string().nullable()`.
       - Update `createToolSchema`: add `passportStatusUrl: z.string().url('Must be a valid URL').nullable().optional().or(z.literal(''))`.
       - Update `initialToolState`: add `passportStatusUrl: ''`.
    3. In `server/utils/lti-tools.ts`:
       - Update `toToolRow`: project `passportStatusUrl: t.passportStatusUrl ?? null`.
       - Update `sanitizeToolData`: sanitize empty string `passportStatusUrl` to `null`.
    4. In `test/unit/shared/schemas/tool.schema.test.ts`:
       - Add assertions for `passportStatusUrl` validation in `createToolSchema` and `toolRowSchema`.
  </action>
  <verify>
    `docker compose exec app-dev pnpm vitest run test/unit/shared/schemas/tool.schema.test.ts`
  </verify>
  <done>
    Tool models and PassPort v1.2 schemas validate status URL fields, Phase 1/Phase 2 version 1.2 payloads, and tool projection helpers without TypeScript or runtime errors.
  </done>
</task>

## Must-Haves

After all tasks complete, verify:

- [ ] Prisma schema contains `passportStatusUrl` on `LtiTool` and `submissionStatus`, `submissionStatusCheckedAt` on `GtaInterviewReservation`.
- [ ] Database migration successfully applied inside Docker.
- [ ] `toolRowSchema` and `createToolSchema` accept and project `passportStatusUrl`.
- [ ] `passPortPhase1RequestSchema` and `passPortPhase2CredentialsSchema` support `1.2` and optional `status_handler`.
- [ ] All unit tests pass.

## Success Criteria

- [ ] All tasks verified passing.
- [ ] Must-haves confirmed.
- [ ] No regressions in existing test suite.
