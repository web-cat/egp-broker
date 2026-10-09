# REQUIREMENTS.md

## Functional Requirements

| ID          | Requirement                                                                                                                     | Source         | Status  |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------- | :------ |
| **REQ-601** | Support 30-minute and 60-minute reservation durations at the Assignment level (`durationMinutes`)                               | SPEC Goal 2    | Pending |
| **REQ-602** | Configure facility elastic seat reserve (`elasticSeatCount`, defaulting to 2) preserving seats for hot spares                   | SPEC Goal 1, 4 | Pending |
| **REQ-603** | Implement 18 phased seats with alternating 2–1 distribution across 12 offsets for 60-minute duration                            | SPEC Goal 1    | Pending |
| **REQ-604** | Implement 18 phased seats with 3 seats per offset across 6 offsets for 30-minute duration                                       | SPEC Goal 2    | Pending |
| **REQ-605** | Enforce offset-specific arrival quotas matching seat allocations (`getMaxArrivalsForOffset`)                                    | SPEC Goal 1    | Pending |
| **REQ-606** | Replace rolling 115-minute overlap count with true seat-specific interval availability check in `generateAvailableSlotsForDate` | SPEC Goal 3    | Pending |
| **REQ-607** | Allocate seats strictly within primary offset channels without circular cross-channel cannibalization in `assignNextSeat`       | SPEC Goal 3    | Pending |
| **REQ-608** | Update student booking endpoint to validate arrival quota and duration-matched seat availability                                | SPEC Goal 3    | Pending |
| **REQ-609** | Update student CBTF booking UI to display slots matching assignment duration (30 min vs 60 min)                                 | SPEC Goal 5    | Pending |
| **REQ-610** | Provide teacher settings controls to toggle CBTF assignment duration (30m vs 60m)                                               | SPEC Goal 5    | Pending |
| **REQ-611** | Full Vitest test suite validating high-throughput scenario with 0 phantom capacity dropouts                                     | SPEC Goal 3    | Pending |
