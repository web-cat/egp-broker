# REQUIREMENTS.md

## Functional Requirements

| ID | Requirement | Source | Status |
| ID | Requirement | Source | Status | Verification Proof |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------- | :------- | :----------------- |
| **REQ-601** | Support 30-minute and 60-minute reservation durations at the Assignment level (`durationMinutes`) | SPEC Goal 2 | Complete | Prisma schema migration `20261009234231` & `assignment.schema.test.ts` |
| **REQ-602** | Configure facility elastic seat reserve (`elasticSeatCount`, defaulting to 2) preserving seats for hot spares | SPEC Goal 1, 4 | Complete | Prisma schema migration `20261009234231` & `cbtf.test.ts` |
| **REQ-603** | Implement 18 phased seats with alternating 2–1 distribution across 12 offsets for 60-minute duration | SPEC Goal 1 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-604** | Implement 18 phased seats with 3 seats per offset across 6 offsets for 30-minute duration | SPEC Goal 2 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-605** | Enforce offset-specific arrival quotas matching seat allocations (`getMaxArrivalsForOffset`) | SPEC Goal 1 | Complete | `cbtf.test.ts` & `cbtf-reservations.test.ts` |
| **REQ-606** | Replace rolling 115-minute overlap count with true seat-specific interval availability check in `generateAvailableSlotsForDate` | SPEC Goal 3 | Complete | `cbtf.test.ts` & `cbtf-simulation.test.ts` |
| **REQ-607** | Allocate seats strictly within primary offset channels without circular cross-channel cannibalization in `assignNextSeat` | SPEC Goal 3 | Complete | `cbtf.test.ts` & `cbtf-reservations.test.ts` |
| **REQ-608** | Update student booking endpoint to validate arrival quota and duration-matched seat availability | SPEC Goal 3 | Complete | `server/api/me/cbtf-reservations.test.ts` |
| **REQ-609** | Update student CBTF booking UI to display slots matching assignment duration (30 min vs 60 min) | SPEC Goal 5 | Complete | `test/unit/app/components/features/cbtf/CbtfScheduleModal.spec.ts` |
| **REQ-610** | Provide teacher settings controls to toggle CBTF assignment duration (30m vs 60m) | SPEC Goal 5 | Complete | `test/unit/app/components/features/admin/AssignmentEditPanel.spec.ts` |
| **REQ-611** | Full Vitest test suite validating high-throughput scenario with 0 phantom capacity dropouts | SPEC Goal 3 | Complete | `test/unit/server/utils/cbtf-simulation.test.ts` |
