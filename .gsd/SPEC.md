# SPEC.md — Project Specification: CBTF Scheduler

> **Status**: `FINALIZED`

## Vision

Provide an integrated Computer-Based Testing Facility (CBTF) scheduling and proctoring system within the EGP Broker platform. The scheduler manages physical workstation capacity, operating hours, and proctor shifts while guiding students through a streamlined progressive selection workflow to reserve 1-hour exam slots. In addition, it equips testing center proctors with real-time check-in, visual photo verification, seat assignment management, and checkout operations to uphold testing integrity.

## Goals

1. **Facility & Capacity Management**: Model a single testing center facility with configurable seat counts, weekly recurring operating hours (M-F), custom calendar exceptions (holidays, lunch breaks, proctor shortages), and a deterministic sequential seat allocation order across 5-minute boundaries.
2. **Deterministic & Throttled Scheduling Engine**: Enforce reservation constraints:
   - 1-hour (60 minute) reservation duration on 5-minute boundaries.
   - Arrival throttling: maximum concurrent arrivals capped at $\lceil \text{total\_seats} / 12 \rceil$.
   - Seat assignment order preserved across consecutive slots.
   - Room must remain open for at least 1 hour past the reservation start time.
3. **Student Progressive Narrowing Experience**: Replace large overwhelming calendar views with a 3-step narrowing wizard:
   - Time-of-day preference (Morning vs. Afternoon).
   - Dynamic recommendation of 3–4 days with lowest center utilization / highest open seat availability.
   - Fixed selection offering a randomly selected open slot per hour within the preferred window.
   - Prevent double-booking and allow rescheduling within the instructor's test window (or pass redemption window).
4. **Instructor Exam Window Management**: Allow instructors to designate assignments as requiring CBTF scheduling, configure open/close scheduling windows, and leverage the existing pass system to issue retake scheduling windows.
5. **Proctor Operations Console**: Provide an operational station interface for proctors:
   - Live roster of arriving, seated, and departing students.
   - ID card check-in with visual photo verification and instant seat routing (plus explicit rejection if unreserved or off-schedule).
   - ID card checkout to vacate seats and complete exam sessions.
   - Work schedule assignment for proctors aligned with facility open hours.

## Non-Goals (Out of Scope)

- Multi-facility or multi-campus physical room routing in v1 (single facility model per institution).
- Dynamic exam durations (all CBTF reservations are strictly fixed at 1 hour).
- Direct hardware turnstile or electronic gate integrations (check-in/checkout is operated by proctors via workstation web console).
- Live exam screen recording or AI-based proctoring webcam feeds (human proctors in the physical facility conduct monitoring).

## Users & Roles

- **Students**: View schedulable assignments on dashboard, execute the progressive reservation wizard, view reservation status, and reschedule within active windows.
- **Instructors / Teachers**: Flag assignments as schedulable, define test availability windows, and issue retake passes.
- **Proctors (`PROCTOR` global role)**: Monitor active sessions, check students in by ID, verify identity photos, guide students to assigned workstations, and check students out.
- **Facility Administrators / Admins**: Configure facility seats, seat allocation sequence, recurring open/close schedules, date-specific exceptions, and assign proctor shifts.

## Constraints

- **Architecture Standards**: Nuxt 4, Vue 3, Nitro, Prisma ORM 6, PostgreSQL, and Zod per `GEMINI.md`.
- **Testing Standard**: 100% test coverage with Vitest for new models, server utilities, API endpoints, and feature composables.
- **Database Migrations**: Clean Prisma schema updates with migrations (`docker compose exec app-dev pnpm prisma migrate dev`).
- **Student ID Uniqueness**: Student identification number stored on `User` for proctor entry and lookup.

## Success Criteria

- [ ] Facility configuration persists capacity, custom seat allocation order, weekly operating hours, and date exceptions.
- [ ] Concurrent arrival throttling strictly enforces $\lceil \text{total\_seats} / 12 \rceil$ per 5-minute interval.
- [ ] Consecutive seat allocation order is respected across successive bookings.
- [ ] Students can reserve, view status on dashboard, and reschedule exams within their eligibility window.
- [ ] Pass redemptions for schedulable assignments grant retake scheduling windows matching pass duration.
- [ ] Proctors can search/scan student IDs, view student photos, see seat assignments, check students in, and check them out.
- [ ] All new logic is covered by unit tests with 0 test regressions.
