Provide an email test button on the admin dashboard that simply sends a test email to the current user. I want to use it to test the current email setup to make sure it works.

for the gta interview schedule, on the teacher dashboard it shows a list of shifts with edit and delete actions.

For the delete and edit actions, when a shift is deleted or edited automatically reschedule any students with reservations that no longer fit within the shift as a result of the change. If students cannot be rescheduled, mark their appointment as cancelled. Show a summary dialog indicating which students were rescheduled to other concurrent shifts (don't change the appointment time--only reschedule if another shift has an available timeslot at the same appointment time), and which were canceled, including student names and emails.

Add a "details" action that will pop up a detail-view dialog showing the GTA name, shift start/end, and the full range of time slots in that shift, indicating who has a reservation in each slot or if it is vacant.
For each individual reservation, provide a button to reschedule (if possible, otherwise cancel).

Viewed TeacherGtaShiftsSection.vue:60-140
Viewed TeacherGtaShiftsSection.vue:520-600
Viewed TeacherGtaShiftsSection.vue:601-720
Viewed TeacherGtaShiftsSection.vue:721-785

Currently, the dialog shows the **results after the adjustment has already been applied** (a post-action summary), rather than a preview beforehand:

### How it currently works:

1. **When editing a shift**:
   - The user changes the date/times in the edit modal and clicks **"Update Shift"**.
   - The server immediately executes the update and performs the reconciliation (moving affected students to concurrent GTAs at that exact same time or cancelling them if no concurrent GTA is available).
   - Once the server responds, if any reservations were affected, the **Impact Summary Dialog** opens displaying the actions that were just performed:
     - Which students were rescheduled (with student name, email, and newly assigned GTA).
     - Which students were cancelled (with student name and email).
2. **When deleting a shift**:
   - The user gets a standard browser confirmation prompt (`Are you sure you want to delete this GTA shift?`).
   - Upon confirming, the shift is deleted and reconciled on the server.
   - If any appointments were rescheduled or cancelled, the **Impact Summary Dialog** opens showing what happened.

---

### Would you like to change this to a pre-confirmation preview?

If you would prefer a **pre-confirmation (dry-run) preview**:

- Before executing the edit or delete, the system would calculate the impact and present the dialog:
  > _"Changing/deleting this shift will reschedule X students and cancel Y students. Do you want to proceed?"_
- The changes would only be committed to the database once the user confirms in that dialog.

Let me know if you'd like to switch to the pre-confirmation approach!
