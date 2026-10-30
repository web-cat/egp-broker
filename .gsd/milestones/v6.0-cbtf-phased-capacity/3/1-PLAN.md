---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Assignment Duration Schema, Server Endpoints & Teacher Configuration UI

## Objective

Extend assignment shared schemas, database operations, and teacher/admin edit panel to allow configuring CBTF reservation duration (`cbtfDurationMinutes` as 30 or 60 minutes) for schedulable assignments, ensuring strict Zod contract validation and updating unit tests.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [shared/models/assignment.ts](file:///Users/edwards/git/egp-broker/shared/models/assignment.ts)
- [server/api/me/assignments/[id].patch.ts](file:///Users/edwards/git/egp-broker/server/api/me/assignments/[id].patch.ts)
- [server/utils/assignments.ts](file:///Users/edwards/git/egp-broker/server/utils/assignments.ts)
- [app/components/features/admin/AssignmentEditPanel.vue](file:///Users/edwards/git/egp-broker/app/components/features/admin/AssignmentEditPanel.vue)
- [test/unit/shared/schemas/assignment.schema.test.ts](file:///Users/edwards/git/egp-broker/test/unit/shared/schemas/assignment.schema.test.ts)
- [test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts](file:///Users/edwards/git/egp-broker/test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts)

## Tasks

<task type="auto">
  <name>Support cbtfDurationMinutes in Assignment Schemas and Server Handlers</name>
  <files>shared/models/assignment.ts,server/api/me/assignments/[id].patch.ts,server/utils/assignments.ts,test/unit/shared/schemas/assignment.schema.test.ts</files>
  <action>
    1. In `shared/models/assignment.ts`:
       - Add `cbtfDurationMinutes: z.number().int().default(60)` to `assignmentRowSchema`.
       - Add `cbtfDurationMinutes: z.number().int().refine((val) => val === 30 || val === 60, { message: 'CBTF duration must be 30 or 60 minutes' }).optional()` to `createAssignmentSchema` and `updateAssignmentSchema`.
    2. In `server/utils/assignments.ts`:
       - Include `cbtfDurationMinutes: data.cbtfDurationMinutes ?? 60` in `createAssignment`.
    3. In `server/api/me/assignments/[id].patch.ts`:
       - Handle `cbtfDurationMinutes: body.cbtfDurationMinutes !== undefined ? body.cbtfDurationMinutes : undefined` in `prisma.assignment.update`.
    4. In `test/unit/shared/schemas/assignment.schema.test.ts`:
       - Add tests verifying valid durations (30, 60) and rejecting invalid durations (e.g. 45, 90).
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/shared/schemas/assignment.schema.test.ts</verify>
  <done>Assignment schemas and server handlers validate and persist cbtfDurationMinutes with 100% test pass rate.</done>
</task>

<task type="auto">
  <name>Add CBTF Duration Controls to AssignmentEditPanel</name>
  <files>app/components/features/admin/AssignmentEditPanel.vue,test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts</files>
  <action>
    1. In `app/components/features/admin/AssignmentEditPanel.vue`:
       - In `state`, add `cbtfDurationMinutes: 60`.
       - In template, under `v-if="state.isSchedulable"`:
         Add duration option selector (e.g. radio buttons or select) allowing the instructor to choose between:
         - "60 Minutes (Standard Exam — up to 50 min test + transition buffer)"
         - "30 Minutes (Quiz / Short Test — up to 25 min quiz + transition buffer)"
       - In `watch` sync:
         `state.cbtfDurationMinutes = assignment?.cbtfDurationMinutes ?? 60`.
       - In `handleSubmit`:
         Include `cbtfDurationMinutes: state.isSchedulable ? (state.cbtfDurationMinutes || 60) : 60` in the payload.
    2. In `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts`:
       - Add test verifying that selecting 30-minute duration submits `cbtfDurationMinutes: 30` in PATCH payload.
       - Add test verifying existing assignment with `cbtfDurationMinutes: 30` initializes state to 30.
  </action>
  <verify>docker compose exec app-dev pnpm vitest run test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts</verify>
  <done>Teacher and admin assignment editing panel provides duration toggle and submits valid duration values.</done>
</task>

## Success Criteria

- [ ] `createAssignmentSchema` and `updateAssignmentSchema` validate `cbtfDurationMinutes` (30 or 60).
- [ ] Server endpoints correctly accept and persist `cbtfDurationMinutes`.
- [ ] `AssignmentEditPanel.vue` presents clear 30m vs 60m controls when `isSchedulable` is toggled on.
- [ ] Unit tests pass cleanly in Docker.
