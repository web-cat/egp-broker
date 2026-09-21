import { describe, it, expect, vi } from 'vitest'
import { combineDateAndTime } from '../../../../shared/utils/timezone'
import {
  calculateMaxArrivalsPerSlot,
  generateAvailableSlotsForDate,
  getOffsetSeatIndices,
  assignNextSeat,
  getFacilityOperatingHoursForDate,
  getStudentSchedulingWindow,
  getRecommendedDaysAndSlots,
  toCbtfReservationDto
} from '../../../../server/utils/cbtf'

describe('CBTF Server Utilities', () => {
  describe('calculateMaxArrivalsPerSlot', () => {
    it('computes ceiling(totalSeats / 12)', () => {
      expect(calculateMaxArrivalsPerSlot(48)).toBe(4) // 48 / 12 = 4
      expect(calculateMaxArrivalsPerSlot(49)).toBe(5) // ceil(4.08) = 5
      expect(calculateMaxArrivalsPerSlot(50)).toBe(5) // ceil(4.16) = 5
      expect(calculateMaxArrivalsPerSlot(12)).toBe(1)
      expect(calculateMaxArrivalsPerSlot(1)).toBe(1)
    })
  })

  describe('combineDateAndTime', () => {
    it('converts calendar date and time to UTC in facility timezone', () => {
      const base = new Date('2026-09-10T00:00:00.000Z')
      // In EDT (UTC-4 in Sep), 08:35 EDT = 12:35 UTC
      const combined = combineDateAndTime(base, '08:35', 'America/New_York')
      expect(combined.toISOString()).toBe('2026-09-10T12:35:00.000Z')

      // In EST (UTC-5 in Jan), 08:35 EST = 13:35 UTC
      const winter = new Date('2026-01-15T00:00:00.000Z')
      const winterCombined = combineDateAndTime(winter, '08:35', 'America/New_York')
      expect(winterCombined.toISOString()).toBe('2026-01-15T13:35:00.000Z')

      // UTC explicitly
      const utcCombined = combineDateAndTime(base, '08:35', 'UTC')
      expect(utcCombined.toISOString()).toBe('2026-09-10T08:35:00.000Z')
    })
  })

  describe('getFacilityOperatingHoursForDate', () => {
    it('returns standard weekly operating hours when no exception exists', async () => {
      const mockTx: any = {
        cbtfScheduleException: { findFirst: vi.fn().mockResolvedValue(null) },
        cbtfOperatingHours: {
          findUnique: vi.fn().mockResolvedValue({
            openTime: '08:00',
            closeTime: '18:00'
          })
        }
      }

      const target = new Date('2026-09-14T00:00:00.000Z') // Monday
      const result = await getFacilityOperatingHoursForDate('fac-1', target, mockTx)

      expect(result.isOpen).toBe(true)
      expect(result.openTime).toBe('08:00')
      expect(result.closeTime).toBe('18:00')
    })

    it('returns closed when schedule exception isClosed is true', async () => {
      const mockTx: any = {
        cbtfScheduleException: {
          findFirst: vi.fn().mockResolvedValue({
            isClosed: true,
            reason: 'Labor Day'
          })
        },
        cbtfOperatingHours: { findUnique: vi.fn() }
      }

      const target = new Date('2026-09-07T00:00:00.000Z')
      const result = await getFacilityOperatingHoursForDate('fac-1', target, mockTx)

      expect(result.isOpen).toBe(false)
      expect(result.reason).toBe('Labor Day')
      expect(mockTx.cbtfOperatingHours.findUnique).not.toHaveBeenCalled()
    })

    it('returns adjusted hours when exception specifies custom open/close times', async () => {
      const mockTx: any = {
        cbtfScheduleException: {
          findFirst: vi.fn().mockResolvedValue({
            isClosed: false,
            openTime: '10:00',
            closeTime: '14:00',
            reason: 'Early Closing'
          })
        },
        cbtfOperatingHours: { findUnique: vi.fn() }
      }

      const target = new Date('2026-09-15T00:00:00.000Z')
      const result = await getFacilityOperatingHoursForDate('fac-1', target, mockTx)

      expect(result.isOpen).toBe(true)
      expect(result.openTime).toBe('10:00')
      expect(result.closeTime).toBe('14:00')
    })
  })

  describe('generateAvailableSlotsForDate', () => {
    const facility = { totalSeats: 48, timezone: 'America/New_York' } // max arrivals per slot = 4
    const targetDate = new Date('2026-09-14T00:00:00.000Z')
    const hours = {
      isOpen: true,
      openTime: '08:00',
      closeTime: '10:00',
      reason: null
    }

    it('generates 5-minute slots that end before or at facility closeTime in facility timezone', () => {
      // 08:00 to 10:00 with 1-hr duration in America/New_York (EDT = UTC-4):
      // 08:00 EDT = 12:00 UTC, 09:00 EDT = 13:00 UTC, 10:00 EDT = 14:00 UTC
      // 08:00, 08:05, ..., 09:00 = 13 slots
      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, [])

      expect(slots.length).toBe(13)
      expect(slots[0].startTime.toISOString()).toBe('2026-09-14T12:00:00.000Z')
      expect(slots[0].endTime.toISOString()).toBe('2026-09-14T13:00:00.000Z')
      expect(slots[slots.length - 1].startTime.toISOString()).toBe('2026-09-14T13:00:00.000Z')
      expect(slots[slots.length - 1].endTime.toISOString()).toBe('2026-09-14T14:00:00.000Z')
    })

    it('enforces arrival throttle: excludes slot if arrivals reach maxArrivals', () => {
      // 08:15 EDT is 12:15 UTC
      const slotTime = new Date('2026-09-14T12:15:00.000Z')
      const existingReservations = [
        { startTime: slotTime, endTime: new Date('2026-09-14T13:15:00.000Z'), seatNumber: 1 },
        { startTime: slotTime, endTime: new Date('2026-09-14T13:15:00.000Z'), seatNumber: 2 },
        { startTime: slotTime, endTime: new Date('2026-09-14T13:15:00.000Z'), seatNumber: 3 },
        { startTime: slotTime, endTime: new Date('2026-09-14T13:15:00.000Z'), seatNumber: 4 }
      ] // 4 arrivals = max for 48 seats

      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, existingReservations)

      // Slot at 08:15 EDT (12:15 UTC) should be excluded
      const has815 = slots.some((s) => s.startTime.getTime() === slotTime.getTime())
      expect(has815).toBe(false)
      // Neighboring slots should still be present (08:20 EDT = 12:20 UTC)
      const has820 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T12:20:00.000Z')
      expect(has820).toBe(true)
    })

    it('enforces room capacity: excludes slot if total overlapping seats are full', () => {
      // Create 48 existing reservations overlapping 08:30 EDT (12:30 UTC)
      const existingReservations = Array.from({ length: 48 }, (_, i) => ({
        startTime: new Date('2026-09-14T12:00:00.000Z'),
        endTime: new Date('2026-09-14T13:00:00.000Z'),
        seatNumber: i + 1
      }))

      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, existingReservations)

      // Any slot between 08:00 and 08:55 EDT overlaps with these 48 reservations
      const has830 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T12:30:00.000Z')
      expect(has830).toBe(false)
      // Slot at 09:00 EDT (13:00 UTC) starts when earlier reservations end, so it should be available
      const has900 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T13:00:00.000Z')
      expect(has900).toBe(true)
    })
  })

  describe('getOffsetSeatIndices', () => {
    it('partitions 24 seats evenly into 2 seats per 5-minute offset', () => {
      expect(getOffsetSeatIndices(24, 0)).toEqual({ startIndex: 0, count: 2 })
      expect(getOffsetSeatIndices(24, 1)).toEqual({ startIndex: 2, count: 2 })
      expect(getOffsetSeatIndices(24, 11)).toEqual({ startIndex: 22, count: 2 })
    })

    it('partitions 50 seats distributing remainder to first offsets', () => {
      // 50 = 12 * 4 + 2 remainder => offsets 0 and 1 get 5 seats, rest get 4 seats
      expect(getOffsetSeatIndices(50, 0)).toEqual({ startIndex: 0, count: 5 })
      expect(getOffsetSeatIndices(50, 1)).toEqual({ startIndex: 5, count: 5 })
      expect(getOffsetSeatIndices(50, 2)).toEqual({ startIndex: 10, count: 4 })
      expect(getOffsetSeatIndices(50, 11)).toEqual({ startIndex: 46, count: 4 })
    })
  })

  describe('assignNextSeat', () => {
    // 24 seats: each 5-min offset gets 2 contiguous seats
    // :00 -> indices 0, 1 (seats 1, 15)
    // :05 -> indices 2, 3 (seats 29, 2)
    // :10 -> indices 4, 5 (seats 16, 30)
    const seatOrder = [
      1, 15, 29, 2, 16, 30, 3, 17, 31, 4, 18, 32, 5, 19, 33, 6, 20, 34, 7, 21, 35, 8, 22, 36
    ]

    it('assigns first seat for arrival at :00 (index 0)', () => {
      const slotStart = new Date('2026-09-14T09:00:00.000Z')
      const slotEnd = new Date('2026-09-14T10:00:00.000Z')
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [])
      expect(seat).toBe(1) // seatOrder[0]
    })

    it('assigns first seat for arrival at :05 (index 2)', () => {
      const slotStart = new Date('2026-09-14T09:05:00.000Z')
      const slotEnd = new Date('2026-09-14T10:05:00.000Z')
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [])
      expect(seat).toBe(29) // seatOrder[2]
    })

    it('assigns second seat for second arrival at :05 (index 3)', () => {
      const slotStart = new Date('2026-09-14T09:05:00.000Z')
      const slotEnd = new Date('2026-09-14T10:05:00.000Z')
      // Seat 29 is occupied by first arrival
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [{ seatNumber: 29 }])
      expect(seat).toBe(2) // seatOrder[3]
    })

    it('reassigns seat 29 at 10:05 once the 9:05 reservation has ended', () => {
      const slotStart = new Date('2026-09-14T10:05:00.000Z')
      const slotEnd = new Date('2026-09-14T11:05:00.000Z')
      // No active reservations overlapping 10:05-11:05
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [])
      expect(seat).toBe(29) // Reclaimed cleanly at turnover
    })

    it('overflows to next available seat if all primary offset seats are occupied', () => {
      const slotStart = new Date('2026-09-14T09:05:00.000Z')
      const slotEnd = new Date('2026-09-14T10:05:00.000Z')
      // Both seats for :05 (29 and 2) are occupied
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [
        { seatNumber: 29 },
        { seatNumber: 2 }
      ])
      // Falls back to next seat in sequence (index 4 -> seat 16)
      expect(seat).toBe(16)
    })

    it('throws 409 if all seats in the facility are occupied', () => {
      const slotStart = new Date('2026-09-14T09:00:00.000Z')
      const slotEnd = new Date('2026-09-14T10:00:00.000Z')
      const allOccupied = seatOrder.map((s) => ({ seatNumber: s }))
      expect(() => assignNextSeat(seatOrder, slotStart, slotEnd, allOccupied)).toThrow(
        'No unallocated seats available at this time slot'
      )
    })
  })

  describe('getStudentSchedulingWindow', () => {
    it('returns assignment window when student has not redeemed a pass', async () => {
      const mockTx: any = {
        passRedemption: { findFirst: vi.fn().mockResolvedValue(null) }
      }
      const assignment = {
        id: 'asg-1',
        scheduleWindowStart: new Date('2026-09-10T08:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-09-20T18:00:00.000Z'),
        availableFrom: null,
        dueDate: null,
        acceptUntil: null
      }

      const window = await getStudentSchedulingWindow('usr-1', assignment, mockTx)
      expect(window.isPassWindow).toBe(false)
      expect(window.start.toISOString()).toBe('2026-09-10T08:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-09-20T18:00:00.000Z')
    })

    it('returns retake pass window when student redeemed a pass for the assignment', async () => {
      const mockTx: any = {
        passRedemption: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'red-1',
            availableFrom: new Date('2026-09-22T08:00:00.000Z'),
            acceptUntil: new Date('2026-09-25T18:00:00.000Z')
          })
        }
      }
      const assignment = {
        id: 'asg-1',
        scheduleWindowStart: new Date('2026-09-10T08:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-09-20T18:00:00.000Z'),
        availableFrom: null,
        dueDate: null,
        acceptUntil: null
      }

      const window = await getStudentSchedulingWindow('usr-1', assignment, mockTx)
      expect(window.isPassWindow).toBe(true)
      expect(window.redemptionId).toBe('red-1')
      expect(window.start.toISOString()).toBe('2026-09-22T08:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-09-25T18:00:00.000Z')
    })
  })

  describe('getRecommendedDaysAndSlots', () => {
    const facility: any = {
      id: 'fac-1',
      totalSeats: 48,
      seatAllocationOrder: Array.from({ length: 48 }, (_, i) => i + 1),
      operatingHours: [
        { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00' }
      ],
      scheduleExceptions: []
    }

    const studentWindow = {
      start: new Date('2026-10-05T00:00:00.000Z'),
      end: new Date('2026-10-09T23:59:59.000Z'),
      isPassWindow: false,
      redemptionId: null
    }

    it('returns half-day blocks divided at 12:30 PM (12:30)', async () => {
      const mockTx: any = {
        cbtfReservation: { findMany: vi.fn().mockResolvedValue([]) },
        cbtfScheduleException: { findFirst: vi.fn().mockResolvedValue(null) },
        cbtfOperatingHours: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const h = facility.operatingHours.find(
              (o: any) => o.dayOfWeek === where.facilityId_dayOfWeek.dayOfWeek
            )
            return Promise.resolve(h || null)
          })
        }
      }

      const result = await getRecommendedDaysAndSlots(
        facility,
        studentWindow,
        '2026-10-05-morning',
        undefined,
        mockTx
      )

      expect(result.blocks.length).toBe(4) // 4 future blocks by default
      expect(result.blocks[0].id).toBe('2026-10-05-morning')
      expect(result.blocks[0].timeRangeLabel).toBe('8:00 AM – 12:30 PM')
      expect(result.blocks[1].id).toBe('2026-10-05-afternoon')
      expect(result.blocks[1].timeRangeLabel).toBe('12:30 PM – 5:00 PM')

      // Morning slots: 8:00 AM – 12:30 PM (4.5 hours = 9 half-hour periods: 8:00..12:00)
      expect(result.hourlySlots.length).toBe(9)
      for (const slot of result.hourlySlots) {
        expect(slot.hour).toBeLessThanOrEqual(12)
        expect(slot.hour).toBeGreaterThanOrEqual(8)
      }
    })

    it('returns one slot per half-hour (7 slots for 3.5 hours of morning arrivals in a 9-5 schedule)', async () => {
      const fourHourFacility: any = {
        id: 'fac-4h',
        totalSeats: 48,
        seatAllocationOrder: Array.from({ length: 48 }, (_, i) => i + 1),
        operatingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' } // 9:00-12:30 morning (3.5 hrs arrivals), 12:30-17:00 afternoon (3.5 hrs arrivals)
        ],
        scheduleExceptions: []
      }

      const mockTx: any = {
        cbtfReservation: { findMany: vi.fn().mockResolvedValue([]) },
        cbtfScheduleException: { findFirst: vi.fn().mockResolvedValue(null) },
        cbtfOperatingHours: {
          findUnique: vi.fn().mockResolvedValue({ openTime: '09:00', closeTime: '17:00' })
        }
      }

      const win = {
        start: new Date('2026-10-05T00:00:00.000Z'),
        end: new Date('2026-10-05T23:59:59.000Z'),
        isPassWindow: false,
        redemptionId: null
      }

      const morningResult = await getRecommendedDaysAndSlots(
        fourHourFacility,
        win,
        '2026-10-05-morning',
        undefined,
        mockTx
      )

      // 9:00 AM to 12:30 PM is 3.5 hours of arrivals -> exactly 7 half-hour slots (9:00 to 12:00 start)
      expect(morningResult.blocks[0].timeRangeLabel).toBe('9:00 AM – 12:30 PM')
      expect(morningResult.hourlySlots.length).toBe(7)
      expect(morningResult.hourlySlots[0].hour).toBe(9)
      expect(morningResult.hourlySlots[morningResult.hourlySlots.length - 1].hour).toBe(12)

      // Afternoon block: 12:30 PM to 5:00 PM (arrivals 12:30 PM up to 4:00 PM = 3.5 hours of arrivals)
      const afternoonResult = await getRecommendedDaysAndSlots(
        fourHourFacility,
        win,
        '2026-10-05-afternoon',
        undefined,
        mockTx
      )
      expect(afternoonResult.blocks[1].timeRangeLabel).toBe('12:30 PM – 5:00 PM')
      expect(afternoonResult.hourlySlots.length).toBe(8) // 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00
      expect(afternoonResult.hourlySlots[0].hour).toBe(12)
      expect(
        afternoonResult.hourlySlots[afternoonResult.hourlySlots.length - 1].formattedTime
      ).toBe('4:00 PM')
    })

    it('chooses candidate slot with maximum openings (fewest arrivals) in each half-hour', async () => {
      // 48 seats -> maxArrivals = 4.
      // In the 9:00-9:30 half-hour on 2026-10-05 (09:00 EDT = 13:00 UTC):
      // Put 2 reservations at 9:00, 1 reservation at 9:05, and 0 at 9:10, 9:15, 9:20, 9:25.
      // The algorithm should choose among 9:10, 9:15, 9:20, 9:25 (which have 0 reservations = 4 openings).
      const mockReservations: any[] = [
        {
          startTime: new Date('2026-10-05T13:00:00.000Z'),
          endTime: new Date('2026-10-05T14:00:00.000Z'),
          seatNumber: 1
        },
        {
          startTime: new Date('2026-10-05T13:00:00.000Z'),
          endTime: new Date('2026-10-05T14:00:00.000Z'),
          seatNumber: 2
        },
        {
          startTime: new Date('2026-10-05T13:05:00.000Z'),
          endTime: new Date('2026-10-05T14:05:00.000Z'),
          seatNumber: 3
        }
      ]

      const testFacility: any = {
        id: 'fac-prioritized',
        totalSeats: 48,
        timezone: 'America/New_York',
        seatAllocationOrder: Array.from({ length: 48 }, (_, i) => i + 1),
        operatingHours: [{ dayOfWeek: 1, openTime: '09:00', closeTime: '13:00' }],
        scheduleExceptions: []
      }

      const mockTx: any = {
        cbtfReservation: { findMany: vi.fn().mockResolvedValue(mockReservations) },
        cbtfScheduleException: { findFirst: vi.fn().mockResolvedValue(null) },
        cbtfOperatingHours: {
          findUnique: vi.fn().mockResolvedValue({ openTime: '09:00', closeTime: '13:00' })
        }
      }

      const win = {
        start: new Date('2026-10-05T00:00:00.000Z'),
        end: new Date('2026-10-05T23:59:59.000Z'),
        isPassWindow: false,
        redemptionId: null
      }

      // Run multiple times to verify randomness stays within the zero-reservation slots
      for (let i = 0; i < 10; i++) {
        const result = await getRecommendedDaysAndSlots(
          testFacility,
          win,
          '2026-10-05-morning',
          undefined,
          mockTx
        )
        const firstHalfHourSlot = result.hourlySlots[0]
        const chosenMinute = new Date(firstHalfHourSlot.startTime).getUTCMinutes()
        // Must NOT be 00 or 05, because 00 has 2 reservations and 05 has 1 reservation
        expect([10, 15, 20, 25]).toContain(chosenMinute)
      }
    })

    it('returns 5 blocks instead of 4 when all evaluated blocks have utilization > 75%', async () => {
      // Create reservations filling > 75% of slots across all blocks
      const mockReservations: any[] = []
      // 48 seats in facility, max arrivals = 4.
      // If we create enough reservations overlapping the hours:
      const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
      for (const day of days) {
        // Operating hours: 08:00 - 18:00 EDT = 12:00 - 22:00 UTC
        // Populate reservations so <= 20% slots are open (>80% utilization)
        for (let h = 12; h < 22; h++) {
          for (let m = 0; m < 60; m += 5) {
            // Fill 4 seats at each 5-min slot
            if (m % 20 !== 0) {
              const startStr = `${day}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00.000Z`
              for (let seat = 1; seat <= 4; seat++) {
                mockReservations.push({
                  startTime: new Date(startStr),
                  endTime: new Date(new Date(startStr).getTime() + 3600000),
                  seatNumber: seat
                })
              }
            }
          }
        }
      }

      const mockTx: any = {
        cbtfReservation: { findMany: vi.fn().mockResolvedValue(mockReservations) },
        cbtfScheduleException: { findFirst: vi.fn().mockResolvedValue(null) },
        cbtfOperatingHours: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const h = facility.operatingHours.find(
              (o: any) => o.dayOfWeek === where.facilityId_dayOfWeek.dayOfWeek
            )
            return Promise.resolve(h || null)
          })
        }
      }

      const result = await getRecommendedDaysAndSlots(
        facility,
        studentWindow,
        undefined,
        undefined,
        mockTx
      )

      // All initial blocks should have utilization > 75% and trigger the 5-block view
      for (const b of result.blocks.slice(0, 4)) {
        expect(b.utilizationPercentage).toBeGreaterThan(75)
        expect(b.isHighDemand).toBe(true) // > 60%
      }
      expect(result.blocks.length).toBe(5)
    })
  })

  describe('toCbtfReservationDto', () => {
    it('projects reservation record to client-safe DTO', () => {
      const raw = {
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        assignment: { title: 'Exam 1' },
        userId: 'usr-1',
        user: { firstName: 'Alice', lastName: 'Smith', studentId: '906000001', avatarUrl: null },
        seatNumber: 5,
        startTime: new Date('2026-09-10T10:00:00.000Z'),
        endTime: new Date('2026-09-10T11:00:00.000Z'),
        status: 'SCHEDULED',
        checkedInAt: null,
        checkedOutAt: null,
        checkedInByUserId: null,
        checkedOutByUserId: null
      }

      const dto = toCbtfReservationDto(raw)
      expect(dto.id).toBe('res-1')
      expect(dto.assignmentTitle).toBe('Exam 1')
      expect(dto.studentName).toBe('Alice Smith')
      expect(dto.studentId).toBe('906000001')
      expect(dto.seatNumber).toBe(5)
      expect(dto.startTime).toBe('2026-09-10T10:00:00.000Z')
    })
  })
})
