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

---

## [DECISION-005] Proctor Console Design & ID Card Swipe Station

**Date**: 2026-09-03
**Status**: Accepted

### Context

Clarification requested for Phase 4 regarding `/proctor` operational console access, duty tracking, screen layout, check-in time tolerance, and card swipe hardware handling.

### Decision

1. **Access & Duty Status**: Permit access to `/proctor` at any time for users with `PROCTOR` or `ADMIN` roles. Provide an explicit toggle switch allowing proctors to turn on/turn off their "on duty" status.
2. **Layout Architecture (Option A Command Center)**:
   - **Header**: Live digital clock, on-duty toggle, real-time counters (Seated, Arriving, Scheduled to Depart).
   - **Left Column**: High-speed ID card swipe check-in / check-out station with automatic swipe parsing, visual photo verification card, seat badge, and clear status alerts.
   - **Right Column**: Live tabs/panels for:
     - **Currently Seated Roster**: Workstation seat number, student name, student ID, exam title, elapsed/remaining time countdown, and 1-click checkout.
     - **Arriving Feed**: Students scheduled for the current or upcoming slot who have not yet checked in.
     - **Departures Feed**: Students who are due to finish or recently checked out.
3. **Check-in Tolerance Windows**:
   - Disallow early check-in beyond 5 minutes prior to start time (`checkInLeadMinutes`, default: 5) to prevent collision with currently seated students.
   - Disallow check-in after 15 minutes past start time (`checkInGraceMinutes`, default: 15) without explicit proctor override.
   - Persist `checkInLeadMinutes` and `checkInGraceMinutes` on `CbtfFacility` so administrators can configure both thresholds from `/admin/cbtf`.
4. **Card Swipe Peripheral Expedited Handling**:
   - Support hardware magnetic stripe / barcode USB wedge readers by auto-focusing the input, automatically stripping track sentinel characters (e.g. `;`, `%`, `?`), and triggering instant lookup on `Enter`.

### Rationale

Empowers proctors with a rapid, error-proof check-in/out station optimized for physical card swipers, guarantees workstation seats are not double-occupied before previous exam ends, and gives facility administrators full control over early/late arrival policies.
