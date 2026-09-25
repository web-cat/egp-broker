---
name: Scheduling Engine Invariants
description: Canonical rules, invariants, and algorithms for CBTF and GTA interview scheduling, half-day block partitioning, lookahead caps, and slot generation
---

# Scheduling Engine Invariants

<role>
You are an expert on the scheduling domain for egp-broker.
Whenever designing, modifying, or debugging CBTF reservation or GTA interview scheduling features,
you MUST consult and strictly enforce the invariants in this document.
</role>

---

## 1. Dual Scheduling Architecture

`egp-broker` operates two distinct scheduling pipelines that share common UI paradigms (two-step dialogs) but differ in capacity models and advance notice constraints:

| Feature Dimension          | CBTF Testing Facility                                       | GTA 1-on-1 Interviews                                       |
| :------------------------- | :---------------------------------------------------------- | :---------------------------------------------------------- |
| **Capacity SSoT**          | Physical facility seats (`TestCenter` workstation capacity) | Active GTA proctor shifts (`GtaShift` concurrent openings)  |
| **Minimum Advance Notice** | **15 minutes** before slot start                            | **2 hours** before slot start                               |
| **Step 1 View**            | Half-day blocks with available seat count                   | Half-day blocks with available GTA interview openings       |
| **Step 2 View**            | Selectable reservation time slots                           | Selectable interview time slots                             |
| **Target Window Bound**    | `openAt` to `dueAt` (or active Pass window)                 | `openAt` to interview window cutoff (or active Pass window) |
| **Canvas Integration**     | Canvas module/quiz assignment overrides                     | Canvas assignment lock/unlock & override sync               |

---

## 2. Step 1: Half-Day Block Partitioning & Capping

In Step 1 of both booking dialogs, students select a half-day block:

### A. Block Partitioning Boundaries

- Each calendar day is divided into two equal blocks split at **1:00 PM (13:00)**:
  - **Morning Block:** Facility opening time (e.g., 09:00) up to 1:00 PM (13:00).
  - **Afternoon Block:** 1:00 PM (13:00) up to Facility closing time (e.g., 17:00).
- Blocks must display date, day of week, time window, and remaining availability.

### B. Lookahead Block Cap

- **Cap Rule:** Display only the next **4 to 5 half-day blocks** that have at least one valid, unreserved slot.
- **NEVER** display an uncapped list of blocks spanning 2+ weeks into the future.
- As days fill up or pass, subsequent blocks rotate into view.

### C. Hard Filtering Invariants

1. **No Past Blocks:** Do not show any half-day block whose end time is before `now`.
2. **Assignment Open Date:** Do NOT show half-day blocks that fall entirely before the assignment's `openAt` date/time.
3. **Assignment Cutoff Date:** Do NOT show half-day blocks that begin after the assignment's allowed submission window (including active pass redemptions).
4. **Zero-Capacity Suppression:** Blocks with 0 available seats or 0 on-duty GTAs must not be offered as selectable.

---

## 3. Step 2: Time Slot Generation & Filtering

In Step 2, students select an exact time slot within their chosen half-day block:

### A. Slot Intervals

- **CBTF:** Generated at 30-minute or 60-minute intervals aligned with exam duration.
- **GTA:** Generated according to the configured interview duration (e.g., 15 or 30 minutes).

### B. Advance Notice Constraints

- **CBTF Slots:** Must be $\ge \text{now} + 15\text{ minutes}$.
- **GTA Slots:** Must be $\ge \text{now} + 2\text{ hours}$. Students must NEVER be allowed to book a GTA interview less than 2 hours in advance.

### C. Bounding Rule

A slot starting at $T_{start}$ and ending at $T_{end}$ is valid if and only if:
$$\max(\text{now} + \text{leadTime}, \text{openAt}) \le T_{start} < T_{end} \le \text{windowEnd}$$
where $\text{windowEnd}$ is the effective assignment deadline (due date + pass extension).

---

## 4. Timezone Sovereignty in Scheduling

Scheduling logic is the most timezone-sensitive domain in the application:

1. **Storage:** All reservation and shift start/end times in Prisma (`CbtfReservation`, `GtaShift`, `GtaReservation`) are strictly stored in **UTC**.
2. **Boundary Calculations:** Block partitions (09:00, 13:00, 17:00) and calendar dates must be calculated in the course timezone (`America/New_York`) via `shared/utils/timezone.ts`, then converted to UTC for DB queries.
3. **Idempotent Overrides:** When syncing reservations with Canvas API overrides, NEVER re-offset a date that is already stored in UTC.

---

## 5. Pass Redemption Interoperability

1. **Pass Balance Rule:** When a student redeems a pass on a CBTF or GTA assignment, their new scheduling window is calculated from the _original assignment due date_, not any temporary reservation override.
2. **Post-Interview Pass Rule:** For an assignment requiring a GTA interview, if a student completes an interview and then redeems a regular (non-extension) pass for revision, they MUST be granted eligibility to schedule a subsequent interview for grading.
3. **Cancellation & Rescheduling:** If a student reschedules, the previous reservation slot is immediately marked cancelled or deleted, releasing the seat or GTA shift capacity.
