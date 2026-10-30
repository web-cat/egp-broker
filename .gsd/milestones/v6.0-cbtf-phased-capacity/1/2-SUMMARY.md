# Plan 1.2 Summary: Core Allocation Mathematics & Behavioral Unit Tests

> **Executed:** 2026-10-09
> **Status:** ✅ Complete
> **Coverage:** 100% Behavioral Coverage, All 42 unit tests passing in `cbtf.test.ts` and 19 tests passing in `cbtf-reservations.test.ts`

---

## 🎯 Deliverables Accomplished

1. **Phased Seat Partitioning (`server/utils/cbtf.ts`)**:
   - Implemented `calculatePhasedSeats(totalSeats, elasticSeatCount = 2)` to calculate phased seats while protecting elastic hot spares.
   - For a 20-seat facility with 2 elastic seats, computes exactly 18 phased seats.
2. **Offset-Specific Arrival Quotas (`getMaxArrivalsForOffset`)**:
   - **60-minute duration**: Partitions 18 seats across 12 arrival offsets in an alternating 2–1 pattern (:00=2, :05=1, :10=2, :15=1, :20=2, :25=1, :30=2, :35=1, :40=2, :45=1, :50=2, :55=1). Sum equals exactly 18.
   - **30-minute duration**: Partitions 18 seats across 6 half-hour offsets with 3 seats each (:00..:25 and :30..:55). Sum across 30 minutes equals 18; sum across 1 hour equals 36.
   - Preserves small array handling for test mocks with $<12$ seats.
3. **Offset Seat Slices & Elastic Protection (`getOffsetSeatIndices`, `assignNextSeat`)**:
   - `getOffsetSeatIndices` computes non-overlapping, contiguous slices for all offsets.
   - `assignNextSeat` restricts circular fallback to phased seats (`0..phasedSeatsCount - 1`) when `elasticSeatCount > 0`, strictly protecting seats 19 and 20 from automated student booking.
   - `calculateMaxArrivalsPerSlot` supports offset-specific quotas while maintaining full backwards compatibility for legacy calls.
4. **Behavioral Unit Tests (`test/unit/server/utils/cbtf.test.ts`)**:
   - Added unit test coverage for `calculatePhasedSeats`, `getMaxArrivalsForOffset`, `calculateMaxArrivalsPerSlot`, `getOffsetSeatIndices`, and `assignNextSeat` elastic pool protection.
   - All 42 unit tests pass cleanly with zero regressions.
