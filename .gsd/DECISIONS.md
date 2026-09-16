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

---

## [DECISION-006] PassPort Registration Callback Token Binding

**Date**: 2026-09-06
**Status**: Accepted

### Context

During Phase 1 PassPort dynamic registration, the Broker initiates registration by POSTing to the external tool's registration URL with a `callback_url`. In Phase 2, the tool pushes its credentials to this callback. We need to securely and deterministically bind the Phase 2 credential delivery to the specific pending `LtiTool`.

### Decision

Generate a unique secure registration token (cuid) stored on `LtiTool.passportRegistrationToken` during Phase 1. Include this token in the callback URL query string: `https://<broker-domain>/api/passport/v1/credentials?token=<cuid>`. When the external tool delivers credentials to this endpoint, the Broker validates the token to find and update the pending `LtiTool`.

### Rationale

Eliminates ambiguity when multiple tools or instances register concurrently, prevents spoofed credential delivery, and ensures strict authorization and idempotency.

---

## [DECISION-007] Fail-Fast Extension Sync with Admin Ntfy and Student Notification

**Date**: 2026-09-06
**Status**: Accepted

### Context

When a student redeems a pass on an assignment linked to an external tool that supports PassPort, the Broker posts the extension to the tool's `extension_handler`. If that network request fails or returns an error (4xx/5xx), we need a clear policy on pass redemption and error reporting.

### Decision

Fail-fast:

1. Block pass redemption: If the PassPort extension POST fails, abort the transaction so the student's pass balance is not decremented and no orphan override is created.
2. Send an immediate administrative alert via `ntfy` (using `alert.service.ts`), providing a summary with student name/email, assignment title, course, and external tool name/URL.
3. Return a user-friendly error to the student UI advising them that extension sync with the external tool failed and instructing them to contact their course instructor.
4. If a downstream LMS sync fails after the tool sync succeeded, send a signed `DELETE` request to the tool's `extension_handler` with the `request_id` to rollback the external extension.

### Rationale

Prevents desynchronization between the Broker, the LMS, and the external learning tool. Ensures students are immediately aware of the issue and instructors/admins are promptly alerted to resolve tool connectivity or configuration problems.

---

## [DECISION-008] Dual Roles and Dedicated Credential Fields on LtiTool

**Date**: 2026-09-06
**Status**: Accepted

### Context

`LtiTool` records may serve two distinct purposes:

1. As an external LTI tool whose launch/outcomes can be proxied (LTI proxy role).
2. As an external tool that supports the PassPort API for recording student extensions (PassPort extension role).
   Tools can support either role or both roles simultaneously, each requiring distinct keys, secrets, and endpoints.

### Decision

Extend the `LtiTool` model in `prisma/schema.prisma` with explicit boolean flags:

- `supportsProxy: Boolean @default(true)`
- `supportsPassport: Boolean @default(false)`
  Separate credentials and endpoints:
- Proxy credentials: `key: String?`, `secret: String?`
- PassPort credentials & endpoints:
  - `passportClientId: String?`
  - `passportClientSecret: String?`
  - `passportRegistrationUrl: String?`
  - `passportExtensionUrl: String?`
  - `passportRegistrationToken: String? @unique`
  - `passportRegistrationStatus: PassPortRegistrationStatus @default(NOT_REGISTERED)` (`NOT_REGISTERED`, `PENDING`, `REGISTERED`, `FAILED`)
  - `passportRegistrationError: String?`
  - `passportRegisteredAt: DateTime?`
  - `passportRequestedProperties: Json?`
    Maintain `supportsExtensionApi: Boolean @default(false)` for backwards compatibility during migration.

### Rationale

Provides clear separation of concerns between LTI proxying and PassPort webhook extension delivery, supports tools that only do one or both, and ensures strict typing across the stack.

---

## DECISION-010: Course-Level Meeting Location for GTA Interviews

### Context

Students need to know where to report to meet their assigned GTA for in-person or virtual grading interviews.

### Decision

Store `interviewLocation` as an optional string on the `Course` model (`Course.interviewLocation`), editable via Course Settings. All GTA interviews for assignments in that course share this meeting location unless individually overridden.

### Rationale

GTAs meet students in a single central lab/office space (e.g. McBryde 106) or central course link. Placing this at the Course level avoids repetitive configuration across assignments and shifts while remaining course-scoped.

---

## DECISION-011: Timeslot-Only Selection with Automatic GTA Assignment

### Context

Multiple GTAs may have overlapping schedules during peak hours. When booking, should students select a GTA or a timeslot?

### Decision

During scheduling, students select timeslots only. The system displays open timeslots based on net available GTA capacity (number of on-duty GTAs minus existing bookings). Upon confirming a slot, the system assigns an available GTA, creates the `GtaInterviewReservation`, and displays the assigned GTA's name on the confirmation screen.

### Rationale

Prevents student bias toward specific GTAs, balances interview workload across on-duty GTAs, and keeps the scheduling interface clean and consistent with the CBTF workflow.

---

## DECISION-012: 10-Minute Slot Cadence (5m Interview + 5m GTA Buffer)

### Context

Grading interviews are brief 5-minute interactions, but GTAs need prep time between students.

### Decision

Slots are anchored every 10 minutes (e.g. 10:00, 10:10, 10:20... 10:50). The interview duration is 5 minutes (e.g. 10:00–10:05), followed by a 5-minute buffer (10:05–10:10) for GTA notes and next student prep.

### Rationale

Maximizes student throughput while guaranteeing GTAs have dedicated turnaround time between consecutive interviews.

---

## DECISION-013: Gating Resubmission Passes on Completed Interviews

### Context

Assignments with grading interviews require students to complete their interview before they can submit revisions using a resubmission pass.

### Decision

In `server/utils/redemptions.ts`, check if `assignment.hasInterviews === true`. If true and the pass being redeemed is a resubmission pass (`passType.extensionOnly === false`), verify that the student has at least one interview reservation with status `COMPLETED` or `CHECKED_OUT`. Otherwise, reject the redemption with an informative error message.

### Rationale

Enforces academic workflow policy: students must receive verbal feedback and code review from their GTA before using course passes to resubmit.

---

## DECISION-014: Dual Shift Management Permissions

### Context

Both course instructors and GTAs need to manage weekly shift availability.

### Decision

Course instructors can view, create, edit, and delete shifts for any user enrolled with `CourseRole.TA` in their course. GTAs (`CourseRole.TA`) can view and manage their own shifts. Both roles can use the weekly schedule parser to batch-generate recurring disconnected shifts.

### Rationale

Empowers GTAs to manage their own availability while maintaining full administrative oversight for course instructors.
