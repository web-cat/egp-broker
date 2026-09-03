# ROADMAP.md

> **Current Phase**: Phase 2
> **Milestone**: v1.0 — CBTF Scheduler

## Must-Haves (from SPEC)

- [x] Facility model with seat capacity, weekly hours, exceptions, and custom seat allocation sequence.
- [ ] Arrival throttling ($\lceil \text{total\_seats} / 12 \rceil$) on 5-minute boundary, 1-hour duration reservations.
- [ ] Deterministic sequential seat allocation across consecutive reservations.
- [ ] 3-step student progressive narrowing wizard (morning/afternoon -> 3-4 days -> 1 slot per hour).
- [ ] Student dashboard status tracking and rescheduling for missed/upcoming reservations.
- [ ] Retake pass integration establishing new scheduling windows.
- [ ] Proctor operational console for live arrivals, departures, student ID check-in with photo verification, and checkout.
- [ ] Admin management of facility configuration and proctor shifts.

---

## Phases

### Phase 1: Foundation & Data Layer

**Status**: ✅ Completed (2026-09-02)
**Objective**: Establish the database models, relations, migrations, seed data, and shared Zod schemas for CBTF facility, proctors, and reservations.
**Requirements**: REQ-01, REQ-02, REQ-03
**Deliverables**:

- Prisma schema updates:
  - `GlobalRole.PROCTOR` enum entry.
  - `User.studentId` unique/indexed field.
  - `Assignment.isSchedulable`, `Assignment.scheduleWindowStart`, `Assignment.scheduleWindowEnd`.
  - `CbtfFacility` (name, totalSeats, seatAllocationOrder).
  - `CbtfOperatingHours` (dayOfWeek, openTime, closeTime).
  - `CbtfScheduleException` (date, isClosed, openTime, closeTime, reason).
  - `CbtfProctorShift` (userId, date, startTime, endTime).
  - `CbtfReservation` (userId, assignmentId, seatNumber, startTime, endTime, status: SCHEDULED, CHECKED_IN, COMPLETED, MISSED, CANCELLED, checkedInAt, checkedOutAt).
- Prisma migration executed in `app-dev` container.
- Shared Zod validation schemas and TypeScript interfaces in `shared/`.
- Unit tests verifying schemas and models.

---

### Phase 2: Core Scheduling Engine & Business Logic

**Status**: ⬜ Not Started
**Objective**: Build server-side scheduling algorithms for progressive slot recommendation, arrival throttling, sequential seat allocation, reservation lifecycle, and pass redemption integration.
**Requirements**: REQ-04, REQ-05, REQ-06, REQ-09, REQ-10
**Deliverables**:

- `server/utils/cbtf.ts`:
  - Operating hours & exception calculation for any target date.
  - 5-minute boundary slot generator ensuring 1-hour open window.
  - Arrival throttle verification ($\le \lceil \text{total\_seats} / 12 \rceil$).
  - Sequential seat allocation algorithm tracking seat order across bookings.
  - Progressive narrowing query utility:
    - Step 1: Morning vs Afternoon slot availability.
    - Step 2: 3–4 lowest-utilization / highest-availability days.
    - Step 3: Random selection of 1 open slot per hour.
- Server API endpoints:
  - `GET /api/me/cbtf/availability`: Returns recommended days and sample slots per student query.
  - `POST /api/me/cbtf/reservations`: Reserves a slot, assigns seat, verifies constraints.
  - `PATCH /api/me/cbtf/reservations/:id`: Reschedule existing or missed reservation.
  - `DELETE /api/me/cbtf/reservations/:id`: Cancel reservation.
- Pass redemption hook: Adjusting scheduling window upon pass redemption.
- Full Vitest suite for scheduling engine edge cases.

---

### Phase 3: Student & Instructor Interfaces

**Status**: ⬜ Not Started
**Objective**: Implement frontend user flows for instructors to configure schedulable assignments and for students to book/manage reservations from their dashboard.
**Requirements**: REQ-03, REQ-07, REQ-08, REQ-09
**Deliverables**:

- Instructor Dashboard & Assignment Edit Panel:
  - Toggle for "Require CBTF Reservation".
  - Date-time pickers for reservation start/end window.
- Student Dashboard Integration:
  - CBTF status pill on assignment rows (Not Scheduled, Scheduled for [Date/Time], Missed, Completed).
  - "Schedule Exam" / "Reschedule" action button.
- Progressive Narrowing Modal (`CbtfScheduleModal.vue`):
  - Step 1: Morning vs. Afternoon preference selector.
  - Step 2: 3–4 Recommended Days card selection with utilization indicators.
  - Step 3: Hourly time slot radio selection and confirmation.
- Feature composable `useCbtfStudent.ts` with error handling and reactive state.
- Vitest unit tests for modal and composables.

---

### Phase 4: Proctor Console & Facility Administration

**Status**: ⬜ Not Started
**Objective**: Build the live proctor operation station for check-in/out and the administrator console for facility parameters.
**Requirements**: REQ-11, REQ-12, REQ-13, REQ-14, REQ-15
**Deliverables**:

- Proctor Console (`/proctor` or `/cbtf/proctor`):
  - Live arrival feed (students arriving in current time window).
  - Live seated roster with assigned workstation numbers.
  - Live departure list (students finishing their 1-hour block).
  - Student check-in: ID scan/entry form, visual avatar/photo display, seat confirmation, error feedback if off-schedule.
  - Student checkout: ID scan/entry, mark session completed, vacate workstation.
- Facility Management (`/admin/cbtf`):
  - Total seats & seat allocation sequence editor.
  - Weekly recurring operating hours editor.
  - Schedule exceptions (holidays, breaks) manager.
  - Proctor shift scheduler.
- CASL permissions and route guards for proctor & admin views.
- Vitest tests covering proctor APIs and UI components.
