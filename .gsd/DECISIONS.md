# DECISIONS.md — Architecture Decision Records

> **Purpose**: Log significant technical decisions and their rationale.

## Decisions

## [DECISION-001] Single CBTF Facility Scope

**Date**: 2026-09-02
**Status**: Accepted

### Context

`cbtf-scheduler.md` describes a Computer-Based Testing Facility with workstations, operating schedules, and proctors. We need to decide whether the initial implementation supports single or multi-facility deployments.

### Decision

Model a single primary testing center facility for the institution.

### Rationale

Simplifies administrative configuration, seat numbering, and schedule querying while fully satisfying all immediate requirements. Can be extended to multi-room in the future if required.

---

## [DECISION-002] Proctor Role Modeling

**Date**: 2026-09-02
**Status**: Accepted

### Context

Proctors require a dedicated station interface for check-in/checkout and managing seated students.

### Decision

Add `PROCTOR` to the `GlobalRole` enum, alongside `ADMIN`, `INSTRUCTOR`, and `USER`. Support proctor shift assignments linking user accounts to facility operational hours.

### Rationale

Aligns cleanly with existing CASL ability system and global role routing middleware without complicating course-level enrollments.

---

## [DECISION-003] Student ID Field on User

**Date**: 2026-09-02
**Status**: Accepted

### Context

Proctor check-in requires entering or barcode-scanning a physical student ID card to pull up reservations and verify photo ID.

### Decision

Add a `studentId` string field (`@unique`, optional) to the `User` model.

### Rationale

Enforces fast indexed lookup during student check-in and check-out at testing center check-in desks.

---

## [DECISION-004] Student Dashboard Layout, Stepper Modal & Admin Facility Pages

**Date**: 2026-09-02
**Status**: Accepted

### Context

Clarification requested for Phase 3 UI architecture, progressive narrowing workflow, and administrative facilities.

### Decision

1. **Student Dashboard (Option A)**: Display inline status and action button in the assignments table plus an "Upcoming Test Reservation" card at the top alongside Pass Pools.
2. **Progressive Narrowing Wizard**: Implement as a dedicated multi-step modal (`CbtfScheduleModal.vue`) with a clear stepper (Time of Day -> Recommended Days -> Hourly Slots -> Confirmation).
3. **Reschedule & Cancel Workflows**: Place both rescheduling and cancellation controls directly within the reservation modal.
4. **Admin Facility Management**: Build full-featured admin management under `/admin/cbtf` (`app/pages/admin/cbtf.vue`) covering Facility settings, Operating Hours, Schedule Exceptions, Proctor Shifts, and Reservations Log with matching server endpoints under `server/api/admin/cbtf/*`.

### Rationale

Provides seamless, prominent visibility of upcoming test bookings for students, avoids scheduling errors with guided progressive narrowing, and gives administrators complete CRUD control over all CBTF data models.
