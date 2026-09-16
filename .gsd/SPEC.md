# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Project**: 1-on-1 Graduate TA Grading Interview Scheduling System
> **Milestone**: v5.0 — Graduate TA Grading Interviews

## Vision

Provide a streamlined, course-integrated 1-on-1 grading interview scheduling system for assignments where students meet with Graduate Teaching Assistants (GTAs) to explain their work as part of the grading process. By adapting the battle-tested scheduling and shift management architecture from the CBTF, this feature allows course staff to define recurring disconnected GTA shifts, calculate overlapping 10-minute appointment slots (5-minute interview + 5-minute prep), enable students to book interviews within a designated assignment window, prevent resubmission pass redemption until interviews are completed, and furnish GTAs with a dedicated check-in, checkout, and grading notes console.

## Goals

1. **Course-Level Configuration & Assignment Integration**:
   - Add a course-level setting for the single interview meeting location (e.g. `Course.interviewLocation`, room number or link).
   - Add assignment-level controls: `hasInterviews` (boolean toggle), `interviewWindowStart` (DateTime), and `interviewWindowEnd` (DateTime).
2. **Course-Scoped GTA Shift Management**:
   - Model GTA shifts tied to a course and a user with the Canvas TA course role (`CourseRole.TA`).
   - Enable both instructors (for all course GTAs) and GTAs (for their own schedules) to enter and batch-generate recurring weekly disconnected shifts (1–2 hour blocks scattered across days) using the natural language schedule parser.
3. **Overlapping Capacity & Automatic GTA Assignment**:
   - Dynamically generate 10-minute interview slots (e.g. 10:00, 10:10, 10:20... with 5-minute student meeting and 5-minute GTA buffer).
   - For overlapping GTA shifts, calculate net capacity per slot across all GTAs on duty.
   - Display half-day blocks only when open GTA interview slots exist.
   - Allow students to select timeslots purely based on time; upon booking, automatically assign the student to an available GTA for that slot and present the assigned GTA name and course interview location in the confirmation.
4. **Student Scheduling & Rescheduling Rules**:
   - Limit students to at most one scheduled interview per assignment at a time.
   - Permit rescheduling once an interview is marked completed, checked out, missed/no-show, or cancelled.
   - Enforce pass redemption gating: if an assignment requires interviews (`hasInterviews = true`), prohibit students from redeeming resubmission passes (`extensionOnly = false`) until their interview has been completed.
5. **GTA Interview Dashboard & Console**:
   - Provide a dedicated, streamlined dashboard for GTAs on duty showing expected student arrivals assigned to them for their shift.
   - Allow manual check-in (no physical ID card swipe required), active interview view with grading notes input, a checkout button, and a save notes button.
   - Support marking absent students as "No-Show" (`MISSED`), immediately freeing the student to reschedule.

## Non-Goals (Out of Scope)

- Physical barcode/magnetic ID swipe scanner workflows (CBTF-only hardware).
- Physical seat allocation or facility floor-plan seating order (all students meet GTAs at the single designated course location or one-on-one).
- Cross-course GTA pooling (shifts and interviews are strictly course-scoped).
- Automatic grade synchronization into Canvas gradebook based on interview completion (grading is entered in Canvas/LMS separately).

## Users

- **Students**: View available interview slots during the assignment window, schedule an appointment, view assigned GTA and meeting location, reschedule if needed, and unlock resubmission passes upon interview completion.
- **Graduate TAs (GTAs)**: Enter recurring weekly shift availability, view expected arrivals for their active shifts, manually check in students, conduct 1-on-1 interviews, record observation notes, check out students, and flag no-shows.
- **Instructors / Course Teachers**: Toggle interview requirements on assignments, set interview date windows, configure course meeting location, and view/manage GTA shifts and interview logs.

## Constraints

- **Strict Nuxt 4 Architecture**: Pure presenter base components, feature-specific composables, Zod validation on API endpoints, and projected Prisma queries.
- **Environment Parity**: Execute all migrations and tests in Docker `app-dev`.
- **Zero Regressions**: Maintain 100% test pass rate across all existing CBTF, PassPort, and LMS sync test suites.
- **Defensive TypeScript**: Derived types from Zod schemas and explicit interfaces; no `any`.

## Success Criteria

- [ ] Database migrations successfully add `Course.interviewLocation`, `Assignment.hasInterviews`, `Assignment.interviewWindowStart/End`, `GtaShift`, `GtaInterviewReservation`, and note relations.
- [ ] Instructors and GTAs can enter and batch-generate recurring weekly shifts using the schedule parser.
- [ ] Available 10-minute slots are correctly calculated from overlapping GTA schedules with accurate capacity tracking.
- [ ] Students can schedule interviews, see assigned GTA on confirmation, and are limited to one active appointment.
- [ ] Students cannot redeem non-extension resubmission passes until their interview is marked `COMPLETED` or `CHECKED_OUT`.
- [ ] GTAs can check in students, enter notes, check them out, or mark no-shows from their dashboard.
- [ ] Vitest unit tests achieve 100% behavioral coverage for all new schemas, utilities, composables, and endpoints.
