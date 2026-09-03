# ROADMAP.md

> **Current Phase**: Phase 4
> **Milestone**: v1.0 — CBTF Scheduler

## Must-Haves (from SPEC)

- [x] Facility model with seat capacity, weekly hours, exceptions, and custom seat allocation sequence.
- [x] Arrival throttling ($\lceil \text{total\_seats} / 12 \rceil$) on 5-minute boundary, 1-hour duration reservations.
- [x] Deterministic sequential seat allocation across consecutive reservations.
- [x] 3-step student progressive narrowing wizard (morning/afternoon -> 3-4 days -> 1 slot per hour).
- [x] Student dashboard status tracking and rescheduling for missed/upcoming reservations.
- [x] Retake pass integration establishing new scheduling windows.
- [ ] Proctor operational console for live arrivals, departures, student ID check-in with photo verification, and checkout.
- [x] Admin management of facility configuration and proctor shifts.

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

**Status**: ✅ Completed (2026-09-02)
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

### Phase 3: Student & Instructor Interfaces + Admin CBTF Management

**Status**: ✅ Completed (2026-09-02)
**Objective**: Implement frontend user flows for instructors to configure schedulable assignments, for students to book/manage reservations from their dashboard, and for administrators to manage facilities, hours, exceptions, proctor shifts, and reservations.
**Requirements**: REQ-03, REQ-07, REQ-08, REQ-09
**Deliverables**:

- Instructor Dashboard & Assignment Edit Panel:
  - Toggle for "Require CBTF Reservation" (`isSchedulable`).
  - Date-time pickers for reservation start/end window.
  - Schedulable badge in assignments table.
- Student Dashboard Integration:
  - Top "Upcoming CBTF Reservation" stat card next to pass pools.
  - CBTF status badge and action button on assignment rows.
- Progressive Narrowing Modal (`CbtfScheduleModal.vue`):
  - Stepper wizard: Step 1 (Morning/Afternoon) -> Step 2 (3-4 Days) -> Step 3 (Hourly slots) -> Step 4 (Confirmation).
  - Reschedule and cancellation actions directly inside modal.
- Admin CBTF Facility Management (`/admin/cbtf`):
  - Facility settings (capacity, seat allocation sequence).
  - Weekly operating hours editor.
  - Schedule exceptions (closures and custom hours) manager.
  - Proctor shift scheduling.
  - Global reservations table with status filtering and management.
  - Server endpoints under `server/api/admin/cbtf/*`.
- Feature composables (`useCbtfStudent.ts`, `useCbtfAdmin.ts`).
- Vitest unit tests for composables, API endpoints, and components.

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
