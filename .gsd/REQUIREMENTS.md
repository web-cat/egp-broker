# REQUIREMENTS.md

## Format & Traceability

| ID     | Requirement                                                                                                                                             | Source      | Status  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| REQ-01 | Single facility model storing seat capacity, recurring weekly hours (day of week, open time, close time), date exceptions, and seat allocation sequence | SPEC Goal 1 | Pending |
| REQ-02 | Add `studentId` field to `User` and `PROCTOR` role to `GlobalRole` enum                                                                                 | SPEC Goal 5 | Pending |
| REQ-03 | Instructor assignment scheduling configuration: `isSchedulable`, `scheduleWindowStart`, `scheduleWindowEnd` properties on `Assignment`                  | SPEC Goal 4 | Pending |
| REQ-04 | 5-minute boundary reservation slots with 1-hour duration ending at or before facility close time                                                        | SPEC Goal 2 | Pending |
| REQ-05 | Arrival throttling: max students scheduled at identical slot $\le \lceil \text{total\_seats} / 12 \rceil$                                               | SPEC Goal 2 | Pending |
| REQ-06 | Sequential seat allocation engine respecting custom seat sequence across consecutive reservations                                                       | SPEC Goal 2 | Pending |
| REQ-07 | Progressive student scheduling wizard (morning/afternoon preference -> 3-4 recommended low-utilization days -> 1 slot per hour selection)               | SPEC Goal 3 | Pending |
| REQ-08 | Student dashboard reservation status display and single active reservation constraint per assignment                                                    | SPEC Goal 3 | Pending |
| REQ-09 | Rescheduling capability for missed or upcoming reservations within open scheduling window                                                               | SPEC Goal 3 | Pending |
| REQ-10 | Integration with pass redemptions: redeeming retake pass creates a new schedulable window based on pass duration                                        | SPEC Goal 4 | Pending |
| REQ-11 | Proctor shift scheduling: proctors assigned to work hours within facility open times                                                                    | SPEC Goal 5 | Pending |
| REQ-12 | Proctor live console displaying current arrivals, departing students, and active seated roster                                                          | SPEC Goal 5 | Pending |
| REQ-13 | Proctor check-in workflow with student ID entry/scan, photo verification, seat assignment display, and mismatch validation                              | SPEC Goal 5 | Pending |
| REQ-14 | Proctor checkout workflow to mark session complete and vacate seat                                                                                      | SPEC Goal 5 | Pending |
| REQ-15 | Admin management UI for facility settings, operating schedule, exceptions, and seat allocation order                                                    | SPEC Goal 1 | Pending |
