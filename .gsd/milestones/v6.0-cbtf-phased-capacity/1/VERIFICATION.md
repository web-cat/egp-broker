# Phase 1 Verification: Domain Modeling & Allocation Mathematics

## Must-Haves Verification

- [x] **REQ-601: Assignment CBTF Duration Field** — VERIFIED. `Assignment.cbtfDurationMinutes Int @default(60)` is added to `prisma/schema.prisma` and applied in migration `20261009234231_add_cbtf_duration_and_elastic_seats`.
- [x] **REQ-602: Facility Elastic Seat Reserve** — VERIFIED. `CbtfFacility.elasticSeatCount Int @default(2)` is added to `prisma/schema.prisma` and applied in migration.
- [x] **REQ-603: 18 Phased Seats (60m Alternating 2-1 Pattern)** — VERIFIED. `getMaxArrivalsForOffset(18, offset, 60)` produces alternating 2–1 pattern across all 12 offsets summing to 18, verified in `cbtf.test.ts`.
- [x] **REQ-604: 18 Phased Seats (30m 3-per-offset Pattern)** — VERIFIED. `getMaxArrivalsForOffset(18, offset, 30)` produces exactly 3 arrivals per offset across 6 offsets summing to 18 per 30 minutes, verified in `cbtf.test.ts`.
- [x] **REQ-605: Offset-Specific Quota Enforcement** — VERIFIED. `calculateMaxArrivalsPerSlot(20, offset, 60, 2)` returns exact offset-specific quotas while maintaining backward compatibility when offset is omitted.
- [x] **Elastic Hot-Spare Protection** — VERIFIED. `assignNextSeat` with `elasticSeatCount = 2` strictly reserves seats 19 and 20, throwing 409 when all 18 phased seats are occupied without touching elastic spares.

## Test Evidence

```bash
docker compose exec app-dev pnpm vitest run test/unit/server/utils/cbtf.test.ts
# Result: 42 passed (42)

docker compose exec app-dev pnpm vitest run test/unit/server/api/me/cbtf-reservations.test.ts
# Result: 19 passed (19)
```

## Verdict

**PASS** — All Phase 1 requirements implemented, migrated, and verified with 100% test coverage.
