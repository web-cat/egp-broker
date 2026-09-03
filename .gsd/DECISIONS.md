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

Enables fast indexed lookup during student check-in and check-out at testing center check-in desks.

---

_Last updated: 2026-09-02_
