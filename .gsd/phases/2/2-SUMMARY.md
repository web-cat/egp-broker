# Plan 2.2 Summary: Reservation Booking Endpoints & High-Throughput Verification

## Implementation Details

- **Dynamic Duration Computation**:
  - In `server/api/me/cbtf/reservations.post.ts`, fetched `cbtfDurationMinutes` on `assignment` query (`assignment.cbtfDurationMinutes ?? 60`). Computed `endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)`.
  - In `server/api/me/cbtf/reservations/[id].patch.ts`, retrieved `existing.assignment.cbtfDurationMinutes` to compute `newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)`.
- **Offset-Specific Arrival Throttling**:
  - Replaced legacy `calculateMaxArrivalsPerSlot(facility.totalSeats)` with `calculateMaxArrivalsPerSlot(facility.totalSeats, offset, durationMinutes, elasticSeatCount)`.
  - Enforced strict offset quota limit before room check: rejecting with HTTP 409 if `concurrentArrivals >= maxArrivals`.
- **Phased Physical Seat Capacity & Allocation**:
  - Replaced naive count check `activeReservations.length >= facility.totalSeats` with true phased seat availability test across `phasedSeatOrder.slice(0, phasedSeats)`.
  - Called `assignNextSeat(seatOrder, startTime, endTime, activeReservations, null, durationMinutes, elasticSeatCount)`, protecting elastic hot spare seats.
- **Unit & Endpoint Verification**:
  - Added test for 30m reservation booking verifying `endTime = startTime + 30m`.
  - Added tests for offset-specific arrival quota verifying rejection when concurrent arrivals reach 1-seat and 2-seat offset limits.
  - Added test for rescheduling verifying that 30m duration is preserved at the new slot.
  - Verified 100% test pass rate across all 22 tests in `test/unit/server/api/me/cbtf-reservations.test.ts` and 44 tests in `test/unit/server/utils/cbtf.test.ts`.
