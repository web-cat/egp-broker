Viewed schedule-new-plan.md:1-34
Viewed schedule-holes.md:1-278
Viewed SKILL.md:1-94
Searched for "generateAvailableSlots"
Viewed cbtf.ts:180-360
Searched for "assignNextSeat"
Viewed reservations.post.ts:240-305
Viewed cbtf.ts:140-180
Searched for "scheduling goals"
Searched for "notes.txt"
Viewed notes.txt:90-160
Ran command: `git log -n 5 --oneline server/utils/cbtf.ts`

### Executive Summary

The scheduling plan proposed in [`schedule-new-plan.md`](file:///Users/edwards/git/egp-broker/schedule-new-plan.md) is an elegant formulation of **Periodic Phased Seat Allocation** (interleaved fixed-cycle channels). It correctly diagnoses and resolves the root cause of the current application’s utilization collapse—namely, the **115-minute rolling window phantom concurrency bug** documented in [`schedule-holes.md`](file:///Users/edwards/git/egp-broker/schedule-holes.md).

However, `schedule-new-plan.md` achieves its theoretical 100% utilization by introducing **extreme operational rigidity**. In its pure form, it assumes zero turnover buffer between consecutive students at a desk, breaks completely when handling non-standard exam durations and disability accommodations (1.5× / 2.0× time), and has no tolerance for broken workstations.

The optimal strategy is a **Buffered Elastic Channel Hybrid**, which retains the phased arrival channels and offset quotas of `schedule-new-plan.md` while incorporating a 5-minute turnover buffer, a dedicated accommodation pool, and true seat-level interval availability verification.

---

### 1. Analysis of the Current Strategy in `egp-broker`

#### How It Works

As implemented in [`server/utils/cbtf.ts`](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts#L184-L241) and [`server/api/me/cbtf/reservations.post.ts`](file:///Users/edwards/git/egp-broker/server/api/me/cbtf/reservations.post.ts#L243-L274):

1. **Candidate Slot Evaluation:** The system generates candidate slots every 5 minutes (:00, :05, ..., :55).
2. **Arrival Throttle:** Rejects a slot if `arrivalsCount >= ceil(totalSeats / 12)`. For 20 seats, this allows up to **2 arrivals** at _every_ 5-minute interval.
3. **Room Capacity Check:** Rejects a slot if `activeReservations.length >= totalSeats`. It computes `activeReservations` by filtering:
   ```typescript
   existingReservations.filter(
     (r) => r.startTime.getTime() < slotEnd.getTime() && r.endTime.getTime() > slotStart.getTime()
   )
   ```
4. **Seat Assignment:** When booking, [`assignNextSeat`](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts#L269-L312) maps the arrival minute to a slice of `seatAllocationOrder`. If those primary seats are taken, it **falls back to any free seat in the room in circular order**.

#### The Fatal Defects

1. **The 115-Minute Phantom Concurrency Trap:**
   - For a 60-minute candidate slot $[T, T + 60)$, any reservation starting between $T - 55\text{ min}$ and $T + 55\text{ min}$ overlaps this window.
   - `activeReservations.length` is therefore the **union of all students arriving across a 115-minute window** (~2 full hours).
   - If just 20 students arrive across 115 minutes (an average of only **~10.4 arrivals/hour** in a 20-seat facility), the algorithm declares the room 100% full—even though at any given minute, only 10 or 11 seats are physically occupied.
   - As documented in [`schedule-holes.md`](file:///Users/edwards/git/egp-broker/schedule-holes.md#L253-L260), this caps effective utilization at **~55%–64% of capacity** (84 students/day instead of the theoretical 140).
2. **Cross-Channel Cannibalization & Swiss-Cheese Fragmentation:**
   - Because the arrival throttle uniformly permits 2 arrivals for every slot, a 1-seat slot (like :10 or :25) can accept 2 students.
   - The second student "steals" Seat 6 (which belonged to the :15 offset) via circular fallback.
   - When another student tries to book at :15, Seat 6 is blocked until 2:10. Over time, unsynchronized bookings slice through the timeline, destroying contiguous 60-minute blocks across all seats.

#### Strengths & Weaknesses

- **Strengths:**
  - Dynamic fallback can theoretically place a student in any available physical chair.
  - Accommodates varied exam lengths or ad-hoc overrides if capacity allows.
- **Weaknesses:**
  - Severely underestimates available capacity due to the 115-minute union bug.
  - Causes scheduling dead-ends and "schedule holes" during peak demand.
  - Uniform throttle (`ceil(N/12) = 2`) over-allocates arrival times that only have 1 physical seat.

---

### 2. Analysis of the Strategy in `schedule-new-plan.md`

#### How It Works

1. **Periodic Phased Channels:** The hour is partitioned into 12 arrival times. The $N$ physical seats are partitioned across these 12 arrival times.
   - For $N=20$: $20 / 12 = 1$ remainder $8$. Eight slots receive 2 dedicated seats, four slots receive 1 dedicated seat, distributed evenly:
     - `:00` $\to$ Seats 1 & 2
     - `:05` $\to$ Seats 3 & 4
     - `:10` $\to$ Seat 5
     - `:15` $\to$ Seats 6 & 7 (and so forth...)
2. **Periodic Orthogonality:** Each seat runs on its own 60-minute non-overlapping cycle (e.g., Seat 1 is exclusively booked for $[H:00, (H+1):00)$).
3. **Dedicated Slot Checks:** A slot at $T$ is available if and only if its assigned dedicated seat(s) are free for that 60-minute window.

#### Core Strengths

1. **Elimination of Phantom Concurrency:** Because seats are assigned to orthogonal phased channels, a reservation on Seat 1 (1:00–2:00) never conflicts with Seat 3 (1:05–2:05). The 115-minute union problem vanishes completely.
2. **100% Theoretical Utilization:** If every slot is booked, the room operates at exactly $N$ concurrent seats occupied at all times ($20 / 20 = 100\%$).
3. **Arrival Throttling by Construction:** Check-in desk congestion is mechanically capped: exactly 1 or 2 students can book any 5-minute arrival time.
4. **$O(1)$ Lookup Complexity:** Availability checking requires inspecting only the 1 or 2 seats bound to that offset, rather than executing range-overlap queries across the entire database table.

#### Critical Weaknesses & Operational Hazards

1. **The Fixed-Duration Blindspot:**
   - The entire phasing model assumes exams are **strictly 60 minutes**.
   - If an assignment uses a 30-minute exam, half of each seat's 1-hour cycle sits idle, dropping utilization to 50%.
   - If an exam is 90 minutes (e.g., a midterm) or 120 minutes (a final), it collides directly with the next hour's reservation on that seat, destroying the cyclic alignment.
2. **Disability Accommodations (1.5× and 2.0× Time):**
   - In university testing centers, a significant percentage of students receive accommodations (e.g., 90 minutes or 120 minutes for a standard 60-minute exam).
   - If an accommodated student takes Seat 1 from 1:00 PM to 2:30 PM, the 2:00 PM slot for Seat 1 cannot run. That seat is knocked out of phase for the remainder of the day.
3. **Turnover Collision & Zero Buffer Time:**
   - If Student A's exam runs 1:00 PM to 2:00 PM on Seat 1, and Student B is scheduled 2:00 PM to 3:00 PM on Seat 1:
     - Student A finishes at 2:00 PM, logs out, gathers their coat/backpack, and walks out.
     - Student B checks in at 2:00 PM, gets briefed by the proctor, walks to Seat 1, and logs in.
     - With zero buffer, Student B either loses test time or physically collides with Student A at the workstation.
4. **Hardware Failure / Broken Workstation Sensitivity:**
   - If Seat 5 has a failed monitor or crashed OS, and Seat 5 is the _only_ seat assigned to `:10`, `:25`, `:40`, or `:55`, those arrival times are completely dead for the entire day.
5. **Demand Inelasticity:**
   - Students naturally prefer round hours (:00) or half-hours (:30). Under rigid static assignment, only 2 students can book at 1:00 PM even if the rest of the facility is 100% empty.

---

### 3. Head-to-Head Comparison

| Evaluation Dimension                 | Current Strategy (`cbtf.ts`)                                  | `schedule-new-plan.md`                                                 | Hybrid Recommendation                                  |
| :----------------------------------- | :------------------------------------------------------------ | :--------------------------------------------------------------------- | :----------------------------------------------------- |
| **Max Achievable Throughput**        | Poor (~55%–64% capacity) due to 115-min rolling window filter | **Theoretical 100%** under uniform demand & 60-min exams               | **High (~90%–95%)** under real-world conditions        |
| **Arrival Throttling**               | Flawed: allows 2 arrivals at slots that only have 1 seat      | **Strict & balanced by construction** (8 slots with 2, 4 slots with 1) | **Strict & balanced** (matches offset seat quotas)     |
| **Schedule Fragmentation ("Holes")** | High: fallback seat stealing creates unaligned gaps           | **Zero** for 60-min exams; extreme if varied durations exist           | **Minimal** (isolated to elastic pool)                 |
| **Turnover / Desk Buffer**           | Implicitly unmanaged                                          | **Zero buffer** (immediate back-to-back collision hazard)              | **5-minute reset buffer** (55-min test in 60-min slot) |
| **Accommodations (1.5×, 2.0×)**      | Handled dynamically (at cost of further fragmentation)        | **Fails completely** (breaks periodic alignment)                       | **Dedicated Accommodation Pool** (2–3 unphased seats)  |
| **Hardware Fault Tolerance**         | High (dynamically picks any other open seat)                  | Low (knocks out specific arrival times)                                | **High** (elastic pool acts as hot spares)             |
| **Computation Complexity**           | $O(R)$ database range scan across entire facility             | $O(1)$ check of dedicated seat indices                                 | $O(1)$ channel check + small elastic pool check        |

---

### 4. Strategic Recommendation: The "Buffered Elastic Channel" Hybrid

Neither the current flawed rolling-window algorithm nor the pure, brittle static plan is ideal on its own. The best architecture is a **Buffered Elastic Channel Hybrid** that takes the phased channel structure of `schedule-new-plan.md` and makes it production-ready.

```
       TOTAL FACILITY CAPACITY (e.g., 20 Seats)
 ┌──────────────────────────────────────────────┬────────────────────────┐
 │      PHASED CHANNELS (e.g., 17 Seats)        │ ELASTIC POOL (3 Seats) │
 │  - Partitioned across 12 arrival offsets     │  - Accommodations      │
 │  - Offset-specific quotas (1 or 2 arrivals)  │    (1.5x, 2.0x time)   │
 │  - 55-min exam + 5-min turnover buffer       │  - Broken seat spares  │
 │  - Non-overlapping 60-min recurring cycle    │  - Non-standard exams  │
 └──────────────────────────────────────────────┴────────────────────────┘
```

#### Core Architectural Elements of the Hybrid:

1. **Partition Seats into Phased Channels and an Elastic Pool:**
   - In a 20-seat room, reserve **17 seats** for standard 60-minute phased scheduling and **3 seats** for the Elastic Pool.
   - For the 17 phased seats: $17 / 12 = 1$ remainder $5$.
     - 5 arrival slots get 2 seats (:00, :15, :25, :35, :50).
     - 7 arrival slots get 1 seat.
   - The 3 elastic seats handle students with 1.5× or 2.0× accommodations, ad-hoc length exams, or emergency workstation swaps.

2. **Incorporate the 5-Minute Turnover Buffer:**
   - Standard exams are defined as **55 minutes of active testing time within a 60-minute reservation window**.
   - A student arriving at 1:00 PM finishes at 1:55 PM. The seat has 5 minutes for logout, wiping/cleaning, and the next student's seating at 2:00 PM. This eliminates physical collisions while preserving the exact 60-minute period.

3. **Quota-Matched Arrival Throttling:**
   - Replace the uniform `Math.ceil(totalSeats / 12)` throttle with the exact seat quota calculated for that offset:
     ```typescript
     export function getMaxArrivalsForOffset(totalSeats: number, offset: number): number {
       const base = Math.floor(totalSeats / 12)
       const remainder = totalSeats % 12
       // Distribute remainder evenly across the 12 offsets
       return base + (isRemainderSlot(offset, remainder) ? 1 : 0)
     }
     ```
   - This prevents 2 students from booking a slot that only has 1 physical seat.

4. **Correct the Underlying Availability Query (Bug Fix):**
   - Replace the 115-minute rolling window filter with **seat-specific interval availability**:
     ```typescript
     // A phased slot is available if any of its assigned channel seats has NO overlapping reservation
     const channelSeats = getSeatsForOffset(offset)
     const hasFreeSeat = channelSeats.some(
       (seat) => !isSeatBookedInWindow(seat, slotStart, slotEnd)
     )
     ```
   - This eliminates the phantom concurrency bug entirely while maintaining lightning-fast, predictable scheduling.

### Summary

Adopting `schedule-new-plan.md` in its pure form would immediately eliminate the false capacity limits reported in [`schedule-holes.md`](file:///Users/edwards/git/egp-broker/schedule-holes.md), but would quickly cause severe operational friction with student turnover and disability accommodations. Implementing the **Buffered Elastic Channel Hybrid** captures virtually all of the throughput gains (~90%–95% practical utilization) while ensuring the application remains robust against real-world testing facility constraints.

---

This hybrid approach provides several benefits. However, there are additional considerations. First, because of course logistics, no exam is actually more than 50 minutes in the current courses, and so there is already buffer time built into the 1-hour blocks. Second, this semester, all students are actually taking 25-minute quizzes. We want the flexibility to support longer (or differing length) reservation blocks in the future, but for immediate needs, 1-hour blocks are more than sufficient. Exploring what would happen in terms of throughput or capacity if we supported both 30-minute and 60-minute blocks (for 25-minute or 50-minute tests or quizzes) is useful. Third, while there are many students who have extra time accommodations, in the current facility we are handling these students through a completely separate system run by our office providing services for students with disabilities. They have their own dedicated testing center with their own scheduler and reservation system. However, they only have the capacity to handle students with extra time accommodations or other accommodations, not all students. So the CBTF is currently serving only students without accommodations (including extra time). Because of this, reserving 3 seats (15%) as a buffer for various purposes may excessively reduce capacity. What would the impact be of using 18 phased seats with a 2 seat elastic pool, and allowing assignments to be classified as either 30 minute or 60 minute assignments with the requirement that the actual quiz/test be limited to at most 25 minutes or 50 minutes respectively to allow for transition time built into the slots?

---

### 1. Mathematical Breakdown of the 18 Phased / 2 Elastic Partition

Partitioning $N = 20$ seats into **18 phased seats** and **2 elastic seats** produces a clean, balanced schedule:

$$18 \text{ seats} \div 12 \text{ offsets} = 1 \text{ seat/offset with remainder } 6$$

Distributing the 6 remainder seats evenly results in a **perfect alternating 2–1 pattern** across the hour:

| 5-Min Arrival Offset | Assigned Phased Seats | Primary Seat Indices |      Arrival Quota       |
| :------------------: | :-------------------: | :------------------: | :----------------------: |
|       **:00**        |           2           |      Seats 1, 2      |            2             |
|       **:05**        |           1           |        Seat 3        |            1             |
|       **:10**        |           2           |      Seats 4, 5      |            2             |
|       **:15**        |           1           |        Seat 6        |            1             |
|       **:20**        |           2           |      Seats 7, 8      |            2             |
|       **:25**        |           1           |        Seat 9        |            1             |
|       **:30**        |           2           |     Seats 10, 11     |            2             |
|       **:35**        |           1           |       Seat 12        |            1             |
|       **:40**        |           2           |     Seats 13, 14     |            2             |
|       **:45**        |           1           |       Seat 15        |            1             |
|       **:50**        |           2           |     Seats 16, 17     |            2             |
|       **:55**        |           1           |       Seat 18        |            1             |
|   **Elastic Pool**   |           2           |     Seats 19, 20     | Unscheduled / Hot Spares |

#### Check-in Flow & Proctor Load:

- **Arrival pace:** Every 10-minute window admits exactly **3 students** ($2 + 1$).
- **Peak arrival burst:** Never exceeds **2 students** in any single 5-minute interval.
- **Reception queue:** A single proctor checking IDs and launching lockdown browsers needs to process at most 2 students every 5 minutes (150 seconds per student), eliminating check-in bottlenecks.

---

### 2. Transition Buffers: Solving the Desk-Collision Hazard

The requirement that test time is strictly capped below slot duration creates guaranteed physical turnover buffers:

1. **60-Minute Slots (50-Minute Test Max):**
   - **Transition Buffer:** **10 minutes** ($T+50$ to $T+60$).
   - Student A departs by 1:50 PM. The workstation sits vacant for 10 minutes, giving proctors time to clean the station, reset browser sessions, or handle delayed exits before Student B sits down at 2:00 PM.
2. **30-Minute Slots (25-Minute Quiz Max):**
   - **Transition Buffer:** **5 minutes** ($T+25$ to $T+30$).
   - Student A departs by 1:25 PM. Workstation resets for 5 minutes before Student B arrives at 1:30 PM.

> [!NOTE]
> This completely resolves the zero-buffer turnover collision that plagued the pure `schedule-new-plan.md` strategy.

---

### 3. Throughput & Capacity: 60-Minute vs. 30-Minute Blocks

Because 30 minutes divides 60 minutes evenly, supporting 30-minute reservation blocks effectively **doubles the turnover frequency** of each phased seat.

#### Capacity Comparison (7-Hour Operating Day, e.g., 9:00 AM – 5:00 PM with 1-hr lunch / shift transitions, or 7 arrival hours):

| Metric                                     |  60-Minute Blocks (50-min test)  | 30-Minute Blocks (25-min quiz)  |       Net Difference       |
| :----------------------------------------- | :------------------------------: | :-----------------------------: | :------------------------: |
| **Phased Seat Turnovers / Hr**             |                18                |             **36**              |          $+100\%$          |
| **Phased Hourly Capacity**                 |         18 students / hr         |      **36 students / hr**       |  $+18\text{ students/hr}$  |
| **Elastic Pool Capacity / Hr** _(if used)_ |         2 students / hr          |         4 students / hr         |  $+2\text{ students/hr}$   |
| **Daily Phased Throughput (7 hrs)**        |      **126 students / day**      |     **252 students / day**      |    **Doubles capacity**    |
| **Daily Total Throughput (incl. Elastic)** |      **140 students / day**      |     **280 students / day**      | $+140\text{ students/day}$ |
| **Days to Test 250 Students**              | **2.0 days** (4 half-day blocks) | **1.0 day** (2 half-day blocks) |    **1 day vs. 2 days**    |

#### Key Takeaway for the Current Semester:

For 25-minute quizzes, **the entire 250-student cohort can be tested in a single 7-hour day** (or across two morning/afternoon blocks on consecutive days with room to spare), while operating at a relaxed proctor check-in pace.

---

### 4. Structuring Phasing for Dual Durations (30m vs. 60m)

To support both 30-minute and 60-minute assignments without creating schedule fragmentation, we must define how seats turn over under each duration.

#### Approach A: Assignment-Homogeneous Mode (Recommended & Simplest)

In practice, courses run either a quiz or an exam during a given scheduling window—rarely do students book a 25-minute quiz and a 50-minute exam simultaneously in the same room.

When an assignment is flagged as **30-minute duration**:

- The turnover period is 30 minutes instead of 60 minutes.
- The 18 seats are partitioned across the **6 arrival offsets within each 30-minute window** (:00, :05, :10, :15, :20, :25, and repeated at :30, :35, :40, :45, :50, :55).
- $18 \div 6 = 3$ seats per offset:
  - `:00` & `:30` $\to$ Seats 1, 2, 3
  - `:05` & `:35` $\to$ Seats 4, 5, 6
  - `:10` & `:40` $\to$ Seats 7, 8, 9
  - `:15` & `:45` $\to$ Seats 10, 11, 12
  - `:20` & `:50` $\to$ Seats 13, 14, 15
  - `:25` & `:55` $\to$ Seats 16, 17, 18
- **Proctor Impact:** At most **3 arrivals every 5 minutes** (1 arrival every 100 seconds). This remains well within single-proctor reception capacity.

#### Approach B: Harmonized Pairing (If 30m and 60m Run Concurrently)

If a future semester mixes 30-minute and 60-minute assignments in the same operating hours, seats are paired across the half-hour mark:

- Seat 1 is assigned to `:00`. If booked for 30 minutes (1:00–1:30), it is eligible to be re-booked at 1:30–2:00.
- **Rule:** A 60-minute exam can only book Seat 1 if both halves $[1:00, 1:30)$ and $[1:30, 2:00)$ are free.
- To prevent 30-minute reservations from fragmenting all 60-minute blocks, designate **Seats 1–10 for 60-min/universal** and **Seats 11–18 for 30-min priority**.

---

### 5. Sizing the Elastic Pool: Why 2 Seats (10%) Is Optimal

Since students with extra-time accommodations are handled off-site by the disability services testing center, the CBTF facility only serves standard-time students.

Reducing the elastic pool from 3 seats (15%) to **2 seats (10%)** has specific operational implications:

1. **Reclaims 1 Full Seat for Core Scheduling:**
   - In 60-minute mode: adds $+1\text{ student/hr}$ $\implies$ $+7\text{ students/day}$.
   - In 30-minute mode: adds $+2\text{ students/hr}$ $\implies$ $+14\text{ students/day}$.
   - Over a 3-day exam window, this reclaims **21 to 42 additional student appointments**.
2. **Adequate Hardware Fault Tolerance:**
   - The primary purpose of the elastic pool is now **hot spares for workstation hardware failures** (e.g., failed peripherals, software lockups) and emergency proctor reassignments.
   - 2 hot spares in a 20-seat room represents a **10% failure margin**. In institutional computer labs, simultaneous hardware failure across $>2$ machines is rare.
3. **Emergency Proctor Buffer:**
   - If a student experiences a software crash at minute 20 of their quiz, the proctor can move them to Elastic Seat 19 to finish without delaying the incoming student on their phased seat.

---

### 6. Architectural Changes Required in `egp-broker`

To implement this design in the codebase, the changes are localized to [`server/utils/cbtf.ts`](file:///Users/edwards/git/egp-broker/server/utils/cbtf.ts):

1. **Assignment Duration Schema:**
   - Add a `durationMinutes` field (defaulting to 60, with support for 30) to the CBTF assignment configuration.
2. **Update `calculateMaxArrivalsPerSlot`:**
   - Replace the uniform `ceil(N/12)` calculation with offset-specific quotas:
     - For 60-min mode: alternating $2, 1, 2, 1 \dots$ (max 2).
     - For 30-min mode: $3$ per slot across the 6 offsets.
3. **Correct `generateAvailableSlotsForDate`:**
   - Remove the rolling 115-minute `activeReservations.length < facility.totalSeats` check.
   - Check slot availability by testing if any of the designated phased seats for that offset are free for $[T, T + \text{durationMinutes})$.
4. **Reserve Elastic Seats (19 & 20):**
   - Phased seat allocation selects from `seatAllocationOrder.slice(0, 18)`. Seats 19 and 20 remain reserved for proctor manual override or emergency failover.

---

### Conclusion

Using **18 phased seats with a 2-seat elastic pool** and supporting **30-minute and 60-minute duration tiers**:

- **Solves the scheduling holes and phantom capacity lockup** completely.
- **Doubles facility throughput** for 25-minute quizzes (up to **252–280 students/day**), allowing 250 students to finish in 1 day instead of 2–3 days.
- **Guarantees 5- to 10-minute transition buffers**, preventing desk collisions.
- **Maintains smooth proctor check-in traffic** (at most 2 arrivals/5 min for 60m exams; at most 3 arrivals/5 min for 30m quizzes).
- **Protects against lab hardware failure** with a dedicated 10% hot-spare capacity.
