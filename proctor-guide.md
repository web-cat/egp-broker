# Computer-Based Testing Facility (CBTF)
# Proctor Training & Operational Guide

> **Welcome to the CBTF Team!**
> As a proctor, you are the front face of our testing operations. You play an essential dual role: providing a welcoming, low-stress environment that helps students perform at their best, while maintaining the vigilance, integrity, and operational consistency that faculty and academic departments rely on.

---

## Table of Contents

1. [The Big Picture: The CBTF Model & Your Role](#1-the-big-picture-the-cbtf-model--your-role)
2. [Professionalism, Tone & Test-Taker Interactions](#2-professionalism-tone--test-taker-interactions)
3. [Facility Policies & Environment](#3-facility-policies--environment)
4. [Shift Workflows & The Testing Center Console](#4-shift-workflows--the-testing-center-console)
   - [Phase A: Shift Start & Preparation](#phase-a-shift-start--preparation)
   - [Phase B: The Check-In Routine](#phase-b-the-check-in-routine)
   - [Phase C: Active Lab Monitoring & Vigilance](#phase-c-active-lab-monitoring--vigilance)
   - [Phase D: The Check-Out Routine](#phase-d-the-check-out-routine)
   - [Phase E: Shift End & Handoff](#phase-e-shift-end--handoff)
5. [Academic Integrity & Incident Protocol](#5-academic-integrity--incident-protocol)
6. [Special Scenarios & Troubleshooting FAQ](#6-special-scenarios--troubleshooting-faq)
7. [Quick Reference Summary](#7-quick-reference-summary)

---

## 1. The Big Picture: The CBTF Model & Your Role

### Why the CBTF Exists

Traditional in-class testing has steep drawbacks: classes lose valuable lecture time, students feel intense synchronized pressure, and retakes or accommodation windows are difficult for instructors to administer.

The **Computer-Based Testing Facility (CBTF)** replaces high-stakes mass testing with a continuous, flexible scheduling model:
- **Rolling 5-Minute Slots**: Students schedule test sessions in staggered 5-minute increments rather than arriving in a large crowd all at once.
- **Arrival Throttling**: The scheduling engine caps concurrent arrivals to $\le \lceil \text{total\_seats} / 12 \rceil$ (e.g., maximum 4 arrivals per 5-minute window for a 48-seat facility). This prevents queues and ensures personal, calm check-ins.
- **Strict 1-Hour Test Blocks**: Each standard exam reservation lasts exactly 60 minutes.
- **Sequential Workstation Rotation**: The system automatically distributes students across workstations to minimize test-peeking and evenly rotate wear on physical equipment.
- **Integrated Retake Windows**: Students using retake passes can self-schedule their makeup or re-try exams within dedicated pass windows.

### Your Role as a Proctor

Your job is balanced between two core responsibilities:

```
                  ┌──────────────────────────────────────────────┐
                  │              THE CBTF PROCTOR                │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │      HOSPITALITY       │                     │       INTEGRITY        │
     │  & ANXIETY REDUCTION   │                     │      & FAIRNESS        │
     ├────────────────────────┤                     ├────────────────────────┤
     │ • Welcoming greeting   │                     │ • Identity check       │
     │ • Reassuring composure │                     │ • Belongings locked    │
     │ • Smooth card swipe    │                     │ • ID card retention    │
     │ • Clear instructions   │                     │ • Continuous roaming   │
     │ • Quiet, orderly space │                     │ • Objective reporting  │
     └────────────────────────┘                     └────────────────────────┘
```

You are neither an interrogator nor a passive bystander. You are an **authoritative, calm facilitator** who ensures every student has an equal, distraction-free opportunity to demonstrate their knowledge under standardized conditions.

---

## 2. Professionalism, Tone & Test-Taker Interactions

Exams produce anxiety. How you greet and treat students directly impacts their focus and physiological state.

### Key Principles

1. **Smile and Greet Every Student Promptly**: When a student approaches the desk, acknowledge them immediately. A warm *"Hi there! Good morning / afternoon"* eases tension.
2. **Speak in Low, Calm, Clear Tones**: The testing room must remain quiet. Speak in a hushed but audible voice so students behind them or in the first row are not disrupted.
3. **Never Express Frustration or Displeasure**: If a student is confused, has arrived on the wrong date, or has trouble scanning their ID, maintain a friendly, problem-solving attitude. Never make a student feel judged or reprimanded.
4. **Be Unobtrusive While Monitoring**: When walking the lab, move slowly, wear quiet footwear, and avoid hovering directly behind any single student for an extended period. Lingering over a student's shoulder induces panic.
5. **No Personal Distractions on Duty**: When on duty, your full attention must be on the room and the check-in station. Do not wear headphones, watch videos, read novels, or browse unrelated social media. Personal cell phones must be on silent.

---

## 3. Facility Policies & Environment

### Belongings & Electronics Policy

> [!IMPORTANT]
> **Zero Personal Belongings at Testing Workstations.**
> All personal items must be placed in the designated storage cubbies/lockers outside or along the lab entrance **before** check-in.

- **Prohibited at Desks**:
  - Backpacks, tote bags, coats, jackets with bulky pockets.
  - Cell phones, smartphones, tablets, smartwatches, fitness bands, wireless headphones, and Bluetooth earbuds.
  - Personal notebooks, textbooks, notes, or binders (unless the course has an instructor-approved open-book policy explicitly documented in the CBTF notes).
  - Food or uncovered beverages (sealed water bottles with labels removed are permitted on the floor beside the desk).
- **Required Action**:
  - Remind the student: *"Please power off your phone and smartwatch, and place your backpack and jacket into a cubby."*
  - Look for smartwatches or earbuds before sending students to their seat.

### Scratch Paper & Writing Utensils

- Proctors supply **official colored scratch paper** (stamped with the CBTF logo/date) and standard sharpened pencils.
- Students are **not** allowed to use their own scratch paper.
- Standard allocation: **1 sheet** of scratch paper upon check-in. If a student fills both sides, they may raise their hand; exchange it for a fresh sheet and retain the used one.
- All scratch paper **must be collected and shredded** at check-out. Students are never permitted to leave the room with scratch paper.

### Restroom Policy

- Standard test sessions are 60 minutes. Students should be encouraged to use the restroom prior to checking in.
- If an emergency restroom break is required during an exam:
  - The student must raise their hand.
  - Note the time they leave and return.
  - The exam timer continues running; no extra time is granted.
  - They must leave their phone in their cubby and cannot take any materials out of the room.

---

## 4. Shift Workflows & The Testing Center Console

Our web application provides the **Testing Center Console** at `/proctor`. It is designed to be your command center throughout your shift.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ TESTING CENTER CONSOLE HEADER (Clock • On-Duty Switch • Live Seated/Arrival KPI Counters)   │
├──────────────────────────────────────────┬──────────────────────────────────────────────────┤
│ LEFT COLUMN: ID Card Swipe Action Station│ RIGHT COLUMN: Live Operations Roster & Feeds     │
│ • Auto-focused input (Reader/Barcode)    │ • Currently Seated Roster (Seat, Name, Timer)    │
│ • Student photo & identity verification  │ • Expected Arrivals Feed                         │
│ • Workstation seat badge (#1-48)         │ • Departures Feed (Ending soon / Completed)      │
│ • Decision alerts & 1-click action keys  │                                                  │
└──────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

### Phase A: Shift Start & Preparation

Arrive **10 minutes before** your scheduled shift begins.

1. **Log in and Launch the Console**:
   - Open your browser and navigate to the application.
   - In the top navigation bar, click the **Testing Center Console** icon (`i-lucide-building-2`) or go directly to `/proctor`.
2. **Toggle Your Proctor Status**:
   - In the top-right header, locate the **Proctor Duty** toggle switch.
   - Click it to turn **ON DUTY**. The badge changes from gray `OFF DUTY` to green `ON DUTY`.
3. **Physical Lab Inspection**:
   - Walk the room. Verify all 48 workstations have power, mouse, keyboard, and clean desk surfaces.
   - Check that the **Alphabetical Desk Tray** for student ID storage is placed next to the card swipe reader.
   - Ensure the check-in desk has a supply of official scratch paper, sharpened pencils, and scratch paper shredding bin.
4. **Card Reader Check**:
   - Click on the ID Card Swipe input field on your screen to ensure the cursor is focused and ready to accept input.

---

### Phase B: The Check-In Routine

Each student check-in follows a strict 5-step sequence:

```
[1. Belongings to Cubbies] ➔ [2. Swipe Student ID] ➔ [3. Photo Verification] ➔ [4. Direct to Seat] ➔ [5. Retain ID Alphabetically]
```

#### Step 1: Cubbies Confirmation
Verify the student has stowed their backpack, jacket, phone, and wearables in the cubby.

#### Step 2: Swipe / Read ID
Ask: *"May I please see your student ID card?"*
- Swipe the magnetic stripe through the USB reader (or scan the barcode).
- The reader will input the card track data and automatically submit.
- *(Manual Fallback)*: If the magnetic stripe is damaged, type their 9-digit Student ID into the box and press **Enter**.

#### Step 3: Photo & Identity Verification
The console will display the **Student Verification Card**:
- **Official Photo**: Look at the screen photo, then look at the student's face. Verify that the person standing in front of you matches the photo.
- **Identity Details**: Confirm the student's name, ID number, and scheduled assignment title.

#### Step 4: Act on the System Decision

The console calculates check-in eligibility in real time and displays one of four color-coded decisions:

---

#### 🟢 Decision 1: `READY_FOR_CHECKIN`
- **When It Happens**: The student has arrived on schedule within the allowed window (from **5 minutes before** their scheduled slot up to **15 minutes after**).
- **Screen Display**: Bright green card highlighting their **Workstation Seat Number** (e.g., `Seat #12`).
- **Action**:
  1. Click **Confirm Check-In** (or simply press **Enter** on your keyboard).
  2. Hand the student **1 sheet of scratch paper** and a pencil.
  3. Clearly state their seat: *"You are at Workstation Seat #12. Please have a seat, wake the computer, and begin your exam. Good luck!"*
  4. **ID Retention**: File their physical ID card into the **Alphabetical Desk Tray** under their last name.

> [!TIP]
> **Hot-Key Efficiency**: When the green `READY_FOR_CHECKIN` card appears, pressing **Enter** instantly confirms the check-in, clears the card, and re-focuses the input for the next student.

---

#### 🟠 Decision 2: `EARLY`
- **When It Happens**: The student arrives more than 5 minutes before their scheduled slot (e.g., arriving 20 minutes early).
- **Why We Hold Them**: Workstations are sequentially assigned to preserve 1-hour durations and prevent workstation collisions with test takers currently finishing their exams.
- **Screen Display**: Amber alert stating: *"Reservation starts at [Time]. Check-in opens at [Time] (5 min prior to slot)."*
- **Action**:
  - Politely inform the student:
    > *"Hi [Name], your exam isn't scheduled to begin until [Time]. Because workstations are currently occupied by ongoing test takers, check-in opens 5 minutes before your slot at [Open Time]. Please wait in the lobby area and come back at that time."*
  - Hand their ID card back to them. Click **Clear** or press Enter.

---

#### 🔴 Decision 3: `LATE` (Past Grace Period)
- **When It Happens**: The student arrives **more than 15 minutes** after their scheduled start time (e.g., slot was 10:00, arrival is 10:18).
- **Policy**: **Strict Adherence.** We do **not** override late check-ins without explicit authorization from the course instructor or CBTF facility manager.
- **Screen Display**: Red alert displaying the late duration and slot details.
- **Action**:
  - Explain calmly and constructively:
    > *"Unfortunately, because it is more than 15 minutes past your scheduled start time, the testing window for this reservation has expired and the seat has been released. You will need to visit your student dashboard to reschedule for the next available slot."*
  - Return their ID card. Click **Clear**.
  - *(Exception)*: Only if you have received direct, written instruction from the course instructor or CBTF manager to accommodate this specific student, click **Override & Check In**.

---

#### ⚪ Decision 4: `NO_ACTIVE_RESERVATION` / `STUDENT_NOT_FOUND`
- **When It Happens**: The student is not enrolled in a schedulable course, has booked for a different day, or does not have an active booking.
- **Action**:
  - Ask the student to check their mobile phone in the lobby or sign into their student dashboard to verify which date and time they selected.
  - Return their ID card. Click **Clear**.

---

### Phase C: Active Lab Monitoring & Vigilance

Once students are seated, your focus shifts to active lab supervision:

1. **Dashboard KPI Counters**:
   - The top header provides live metrics:
     - **Seated**: Total students currently testing vs. facility capacity (e.g., `18 / 48`).
     - **Arriving**: Number of students scheduled to check in during the current slot.
     - **Departing Soon**: Number of students with 10 or fewer minutes remaining in their 1-hour session.
2. **Currently Seated Tab**:
   - Shows all active workstations with student names, IDs, assignment titles, and **Time Left**.
   - Students with $\le 10$ minutes remaining display a highlighted, pulsing amber pill (`X min`) to alert you that they will be finishing shortly.
3. **Continuous Physical Vigilance**:
   - Stand up and roam the room at randomized intervals (approximately every 5 to 7 minutes).
   - Glance at screens from the back of the room to verify students remain within the approved testing browser window.
   - Check that no student has an unauthorized phone or notes on their desk or lap.
   - Look for hand-signals from students needing scratch paper exchange or experiencing workstation issues.

---

### Phase D: The Check-Out Routine

When a student finishes their exam, they will bring their scratch paper and pencil up to the proctor desk:

```
[1. Student Returns to Desk] ➔ [2. Retrieve ID from Tray] ➔ [3. Swipe ID / Check Out] ➔ [4. Collect Scratch Paper] ➔ [5. Return ID]
```

1. **Locate Their ID Card**:
   - Check the student's name. Look in the **Alphabetical Desk Tray** and locate their physical card.
2. **Execute Check-Out in Software**:
   - **Method A (Card Reader)**: Swipe their card through the reader. The system detects they are currently seated and displays the blue `READY_FOR_CHECKOUT` card. Press **Enter** to confirm.
   - **Method B (Roster Click)**: On the **Currently Seated** roster, locate their row and click the **Check Out** button.
3. **Collect Materials**:
   - Take their used scratch paper and pencil.
   - Drop the scratch paper directly into the shredding bin.
4. **Return Physical ID**:
   - Hand their ID card back to the student:
     > *"You are all set and checked out! Have a wonderful day."*

> [!IMPORTANT]
> **Always Return the ID Card!**
> The physical ID card must never leave the desk except in the hands of the student who owns it. The check-out confirmation banner explicitly reminds you: `"RETURN student ID to student."`

---

### Phase E: Shift End & Handoff

When your shift concludes and the replacement proctor arrives:

1. **Verbal Status Briefing**:
   - Walk through the **Currently Seated** roster together. Point out any students who started late or have accommodation accommodations.
2. **Tray Audit**:
   - Verify that the number of physical ID cards in the alphabetical tray matches the number of currently seated students on the screen.
3. **Physical Supply Restock**:
   - Ensure scratch paper and sharpened pencils are replenished for the incoming proctor.
4. **Toggle Off Duty**:
   - On your workstation, toggle the **Proctor Duty** switch to `OFF DUTY`.
   - Log out of your session so the incoming proctor can log into their own account.

---

## 5. Academic Integrity & Incident Protocol

The CBTF relies on quiet, objective documentation rather than disruptive confrontations.

### Protocol for Suspected Infractions

If you observe behavior that appears to violate academic integrity (e.g., unauthorized website, notes under the keyboard, glancing at a neighbor's screen, looking at a phone):

```
                       SUSPECTED INFRACTION DETECTED
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │  1. REMAIN CALM & DO NOT CONFRONT │
                   │  Do NOT shout, grab tests, or     │
                   │  cause a scene in the quiet room. │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │  2. QUIETLY OBSERVE & DOCUMENT    │
                   │  • Note exact workstation seat #  │
                   │  • Note exact time and duration   │
                   │  • Record student name from roster│
                   │  • Take discreet photo if possible│
                   │  • Note what was on the screen    │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │  3. ALLOW TEST TO CONCLUDE        │
                   │  Let student finish their 1-hour  │
                   │  block without public disruption. │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │  4. COMPLETE INCIDENT REPORT      │
                   │  Immediately email course faculty │
                   │  and CBTF facility manager.       │
                   └───────────────────────────────────┘
```

### What to Include in the Incident Email
Send an email to the **Course Instructor** and **CBTF Facility Manager** with:
- Student Name and Student ID number.
- Date, exact time, and Workstation Seat Number.
- Course and Assignment title.
- Factual description of what was observed (e.g., *"Student was observed with an index card containing handwritten formulas placed beneath their mousepad at 14:22"*).
- Attach any photos taken.

---

## 6. Special Scenarios & Troubleshooting FAQ

### Q: A student arrives without their physical Student ID card.
**A**: We require positive photo identification. If they do not have their university student ID card, they may present a valid government-issued photo ID (Driver's License, Passport, or State ID). Look up their account in the console by typing their Student ID number manually. Verify that the legal name on their government ID matches the name on their student profile.

### Q: The card swipe reader does not respond or gives an error.
**A**: The reader is a standard USB keyboard peripheral.
1. Click your mouse inside the input field so the cursor is actively blinking.
2. Swipe the card with a smooth, moderate speed (not too fast, not too slow).
3. If the card's magnetic stripe is worn or unreadable, ask the student for their ID number and manually type it into the input box, then press Enter.

### Q: A student's workstation freezes, crashes, or loses power.
**A**:
1. Remain calm and reassure the student: *"Don't worry, your work is saved in the testing system."*
2. If a simple reboot fixes the issue within 2 minutes, let them resume.
3. If the machine is unusable, check the **Currently Seated** roster for an empty workstation. Move the student to the open seat, log them in, and note the time delay.
4. Contact the CBTF facility manager to tag the broken workstation for maintenance.

### Q: A student feels ill or faint during an exam.
**A**: Student health and safety always take precedence over exam procedures.
1. Immediately assist the student away from the computer to fresh air or the proctor desk. Offer water.
2. If medical assistance is needed, follow campus emergency protocol immediately.
3. Note the exam stop time. Email the course instructor and CBTF manager so the student can be granted an excused retake once recovered.

---

## 7. Quick Reference Summary

| Phase | Core Proctor Action | Software Key / Command |
|---|---|---|
| **Shift Start** | Check room, inspect 48 seats, ready supplies & tray | Click **Proctor Duty** toggle $\rightarrow$ `ON DUTY` |
| **Check-In** | Verify cubbies, check photo, hand scratch paper | Swipe card $\rightarrow$ Review screen $\rightarrow$ Press **Enter** |
| **Direct to Seat** | Tell student their assigned seat number | Workstation `#` highlighted in green badge |
| **ID Retention** | Place student ID into Alphabetical Desk Tray | Filed by **Student Last Name** |
| **Early Arrival** | Politely ask student to wait in lobby until 5 min prior | Hand ID back $\rightarrow$ Click **Clear** |
| **Late Arrival** | Explain 15-min grace expired; advise to reschedule | Hand ID back $\rightarrow$ Do not override without approval |
| **Monitoring** | Roam room every 5–7 min; watch for pulsing timers | Monitor **Currently Seated** roster at `/proctor` |
| **Check-Out** | Retrieve ID from tray, collect & shred scratch paper | Swipe card or click **Check Out** $\rightarrow$ Press **Enter** |
| **Return ID** | Hand ID card back to student | Confirm checkout prompt: *"RETURN student ID"* |
| **Integrity Issue**| Discreetly note time, seat #, photo; no scene | Email Instructor + CBTF Manager post-test |
| **Shift End** | Audit tray with incoming proctor, restock paper | Click **Proctor Duty** toggle $\rightarrow$ `OFF DUTY` |

---

*Document maintained by CBTF Facility Administration.*  
*For questions, facility emergencies, or policy clarifications, contact your lead CBTF Manager.*
