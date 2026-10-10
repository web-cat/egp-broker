Searched for "schedule"
Viewed CbtfScheduleModal.vue:1-572
Viewed useCbtfStudent.ts:1-100
Viewed cbtf.ts:1-100
Viewed cbtf.ts:100-110
Searched for "CbtfScheduleModal"
Viewed Student.vue:120-160
Viewed Student.vue:40-110
Searched for "/api/me/cbtf/availability"
Listed directory me
Listed directory cbtf
Viewed availability.get.ts:1-100
Viewed reservations.post.ts:1-60

When a student opens the dialog to schedule (or reschedule) a CBTF (Computer-Based Testing Facility) quiz or exam (via [`CbtfScheduleModal.vue`](file:///Users/edwards/git/egp-broker/app/components/features/cbtf/CbtfScheduleModal.vue)), the dialog operates as a **4-step progressive narrowing wizard**, followed by a confirmation summary screen.

---

### Preliminary Step (If an existing reservation exists)

If the student already holds a reservation for that assignment, the dialog initially opens in **Reservation View** instead of the wizard:

- **Information Displayed:** Current assignment, scheduled date & time window, assigned workstation seat number, and status badge (`SCHEDULED` or `MISSED`).
- **Choices:**
  - **Cancel Reservation:** (Available if `SCHEDULED`) Cancels the booking.
  - **Reschedule Exam:** (Available if `SCHEDULED` or `MISSED`) Launches the 4-step wizard with rescheduling mode enabled.

---

### The 4-Step Scheduling Wizard

#### **Step 1: Time of Day (Preference Selection)**

- **Goal:** Narrows down availability to the student's preferred diurnal window.
- **Choices:**
  1. **Morning:** Testing slots starting before 12:00 PM.
  2. **Afternoon:** Testing slots starting from 12:00 PM onwards.
- **Student Action:** Selecting either card highlights the choice, loads testing center capacity for that preference, and automatically advances the student to Step 2 (or the student can click "Next").

---

#### **Step 2: Select Day (Recommended Dates)**

- **Goal:** Helps the student select an available day within their allowed test window while balancing testing center capacity.
- **Choices:**
  - The student is presented with a list of **Recommended Days** within their testing window (which accounts for assignment availability and any pass/accommodation extensions).
  - For each day card, the student sees:
    - **Day & Date Label** (e.g., _Monday, Sep 15_).
    - **Open Slots Count** badge (e.g., _18 slots_).
    - **Room Utilization Indicator:** A progress bar and percentage showing how full the facility is (color-coded green for <50%, amber for 50–79%, red for ≥80%).
- **Student Action:** The student chooses a specific date. Selecting a day automatically loads the open hourly slots for that date and advances to Step 3 (the student can also click "Back" to change their morning/afternoon preference).

---

#### **Step 3: Pick Time Slot (Hourly Slot Selection)**

- **Goal:** Selects an exact one-hour testing window for the chosen date.
- **Choices:**
  - A grid of available **Hourly Time Slots** (e.g., _9:00 AM_, _10:00 AM_, _2:00 PM_).
  - Only slots where the facility is open, within operating/exception hours, staffed, and within maximum arrival and capacity limits are displayed.
- **Student Action:** The student selects one specific hourly slot. Selecting a slot highlights it and advances to Step 4 (or the student can click "Back" to choose a different day).

---

#### **Step 4: Review & Confirm**

- **Goal:** Final review of the reservation parameters prior to deterministic seat allocation.
- **Information Displayed:**
  - **Assignment Name** (e.g., _Midterm 1_).
  - **Reservation Duration:** 60 minutes.
  - **Selected Date:** (e.g., _Monday, Sep 15_).
  - **Selected Time Slot:** (e.g., _10:00 AM – 11:00 AM_).
  - Notice explaining that their workstation seat will be assigned deterministically upon booking.
- **Choices:**
  - **Back:** Return to Step 3 to pick a different time or date.
  - **Cancel:** Close the modal without scheduling.
  - **Confirm Reservation** (or **Confirm Reschedule**): Finalizes the booking via the API.

---

### Post-Confirmation Screen (Success)

Once confirmed, the modal displays the booking results:

- Confirmation banner (_"Exam Confirmed!"_) with the exact date and 1-hour time window.
- **Assigned Workstation:** Displays the student's assigned seat number (e.g., _Seat #12_), assigned using the facility's seat allocation order.
- **Instructions:** Reminds the student to arrive 5–10 minutes early with their student photo ID card.
- **Done:** Closes the dialog.

---

Isues:

In terms of step 2 (choosing morning or afternoon) and step 3 (choosing the day),
use 1pm instead of 12pm as the dividing line between morning and afternoon--that is, to
divide the day into two halves for schedule selection. Instead of allowing a morning/afternoon
choice and then a day choice as two separate steps, instead focus on offering a 4-block
choice of the next four half-days when slots for the given assignment are open. If there
is currently a half-day block in progress at the time when the student enters the
scheduling process, show the current block, plus the next four. If all of those blocks have
utilization > 75% (i.e., fewer than 25% of seats open across the whole block), then show
the next 5 blocks instead of next 4 (in addition to the currently active block, if any).
Show utlization percent (i.e., "65% full") for each block, highlighting capacities over 60%
with an appropriate color and icon. Determine if any data should be added to the data model to support this approach, including data that is incrementally updated each time a student
schedules a slot.
