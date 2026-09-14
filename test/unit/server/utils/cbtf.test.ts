import { describe, it, expect, vi } from 'vitest'
import {
  calculateMaxArrivalsPerSlot,
  combineDateAndTime,
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
    it('sets UTC hours and minutes from time string', () => {
      const base = new Date('2026-09-10T00:00:00.000Z')
      const combined = combineDateAndTime(base, '08:35')
      expect(combined.toISOString()).toBe('2026-09-10T08:35:00.000Z')
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
    const facility = { totalSeats: 48 } // max arrivals per slot = 4
    const targetDate = new Date('2026-09-14T00:00:00.000Z')
    const hours = {
      isOpen: true,
      openTime: '08:00',
      closeTime: '10:00',
      reason: null
    }

    it('generates 5-minute slots that end before or at facility closeTime', () => {
      // 08:00 to 10:00 with 1-hr duration:
      // Slots can start from 08:00 up to 09:00 (since 09:00 + 1h = 10:00)
      // 08:00, 08:05, ..., 09:00 = 13 slots
      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, [])

      expect(slots.length).toBe(13)
      expect(slots[0].startTime.toISOString()).toBe('2026-09-14T08:00:00.000Z')
      expect(slots[0].endTime.toISOString()).toBe('2026-09-14T09:00:00.000Z')
      expect(slots[slots.length - 1].startTime.toISOString()).toBe('2026-09-14T09:00:00.000Z')
      expect(slots[slots.length - 1].endTime.toISOString()).toBe('2026-09-14T10:00:00.000Z')
    })

    it('enforces arrival throttle: excludes slot if arrivals reach maxArrivals', () => {
      const slotTime = new Date('2026-09-14T08:15:00.000Z')
      const existingReservations = [
        { startTime: slotTime, endTime: new Date('2026-09-14T09:15:00.000Z'), seatNumber: 1 },
        { startTime: slotTime, endTime: new Date('2026-09-14T09:15:00.000Z'), seatNumber: 2 },
        { startTime: slotTime, endTime: new Date('2026-09-14T09:15:00.000Z'), seatNumber: 3 },
        { startTime: slotTime, endTime: new Date('2026-09-14T09:15:00.000Z'), seatNumber: 4 }
      ] // 4 arrivals = max for 48 seats

      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, existingReservations)

      // Slot at 08:15 should be excluded
      const has815 = slots.some((s) => s.startTime.getTime() === slotTime.getTime())
      expect(has815).toBe(false)
      // Neighboring slots should still be present
      const has820 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T08:20:00.000Z')
      expect(has820).toBe(true)
    })

    it('enforces room capacity: excludes slot if total overlapping seats are full', () => {
      // Create 48 existing reservations overlapping 08:30
      const existingReservations = Array.from({ length: 48 }, (_, i) => ({
        startTime: new Date('2026-09-14T08:00:00.000Z'),
        endTime: new Date('2026-09-14T09:00:00.000Z'),
        seatNumber: i + 1
      }))

      const slots = generateAvailableSlotsForDate(facility, targetDate, hours, existingReservations)

      // Any slot between 08:00 and 08:55 overlaps with these 48 reservations
      const has830 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T08:30:00.000Z')
      expect(has830).toBe(false)
      // Slot at 09:00 starts when earlier reservations end, so it should be available
      const has900 = slots.some((s) => s.startTime.toISOString() === '2026-09-14T09:00:00.000Z')
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

    it('returns half-day blocks divided at 1:00 PM (13:00)', async () => {
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
      expect(result.blocks[0].timeRangeLabel).toBe('8:00 AM – 1:00 PM')
      expect(result.blocks[1].id).toBe('2026-10-05-afternoon')
      expect(result.blocks[1].timeRangeLabel).toBe('1:00 PM – 5:00 PM')

      // Morning hourly slots should start before 1:00 PM (hour < 13)
      for (const slot of result.hourlySlots) {
        expect(slot.hour).toBeLessThan(13)
        expect(slot.hour).toBeGreaterThanOrEqual(8)
      }
    })

    it('returns 5 blocks instead of 4 when all evaluated blocks have utilization > 75%', async () => {
      // Create reservations filling > 75% of slots across all blocks
      const mockReservations: any[] = []
      // 48 seats in facility, max arrivals = 4.
      // If we create enough reservations overlapping the hours:
      const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
      for (const day of days) {
        // Morning: 08:00 - 13:00 (5 hours, 60 5-min slots).
        // Populate reservations so <= 20% slots are open (>80% utilization)
        for (let h = 8; h < 17; h++) {
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
