---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Database Schema & Migration for CBTF Duration and Elastic Seats

## Objective

Extend the Prisma domain model to support assignment-level CBTF reservation durations (30m vs. 60m) and facility-level elastic seat reservation (hot spares for hardware failure and proctor emergencies). Create and apply the database migration cleanly within the Docker environment.

## Context

- [.gsd/SPEC.md](file:///Users/edwards/git/egp-broker/.gsd/SPEC.md)
- [.gsd/DECISIONS.md](file:///Users/edwards/git/egp-broker/.gsd/DECISIONS.md) (DECISION-015, DECISION-016, DECISION-017)
- [prisma/schema.prisma](file:///Users/edwards/git/egp-broker/prisma/schema.prisma)

## Tasks

<task type="auto">
  <name>Update Prisma Schema with cbtfDurationMinutes and elasticSeatCount</name>
  <files>prisma/schema.prisma</files>
  <action>
    In `prisma/schema.prisma`:
    1. Update model `Assignment`:
       - Add field `cbtfDurationMinutes Int @default(60)` under CBTF Scheduling properties.
       - Include descriptive documentation indicating supported values (60 for 50-min exam, 30 for 25-min quiz).
    2. Update model `CbtfFacility`:
       - Add field `elasticSeatCount Int @default(2)` under facility configuration.
       - Document that elastic seats are reserved for hardware failure failover and proctor emergency reassignments.
  </action>
  <verify>git diff prisma/schema.prisma</verify>
  <done>Both fields exist in `prisma/schema.prisma` with appropriate default values and documentation.</done>
</task>

<task type="auto">
  <name>Generate and Apply Prisma Migration in Docker</name>
  <files>prisma/migrations/*</files>
  <action>
    Run Prisma migration inside the `app-dev` container:
    `docker compose exec app-dev pnpm prisma migrate dev --name add_cbtf_duration_and_elastic_seats`
    Ensure Prisma Client is regenerated. If an advisory lock timeout occurs, terminate idle locking backends per GEMINI.md Section III.
  </action>
  <verify>docker compose exec app-dev pnpm prisma status</verify>
  <done>Migration file generated in `prisma/migrations/` and database schema is up-to-date with 0 pending migrations.</done>
</task>

## Success Criteria

- [ ] `Assignment.cbtfDurationMinutes` exists with `@default(60)`.
- [ ] `CbtfFacility.elasticSeatCount` exists with `@default(2)`.
- [ ] Prisma migration executes successfully inside Docker container `app-dev`.
- [ ] Prisma Client types generated and clean.
