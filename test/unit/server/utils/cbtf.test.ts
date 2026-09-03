import { describe, it, expect, vi } from 'vitest'
import {
  calculateMaxArrivalsPerSlot,
  combineDateAndTime,
  generateAvailableSlotsForDate,
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

  describe('assignNextSeat', () => {
    const seatOrder = [1, 15, 29, 2, 16, 30]
    const slotStart = new Date('2026-09-14T09:00:00.000Z')
    const slotEnd = new Date('2026-09-14T10:00:00.000Z')

    it('allocates the first seat in order when no prior reservation exists', () => {
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [], null)
      expect(seat).toBe(1)
    })

    it('allocates the next seat in sequence after lastAssignedSeat', () => {
      const seat1 = assignNextSeat(seatOrder, slotStart, slotEnd, [{ seatNumber: 1 }], 1)
      expect(seat1).toBe(15)

      const seat2 = assignNextSeat(
        seatOrder,
        slotStart,
        slotEnd,
        [{ seatNumber: 1 }, { seatNumber: 15 }],
        15
      )
      expect(seat2).toBe(29)
    })

    it('skips occupied seats and continues through the sequence', () => {
      // Seat 15 is occupied by an earlier ongoing exam
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [{ seatNumber: 15 }], 1)
      expect(seat).toBe(29)
    })

    it('wraps around the sequence order', () => {
      // Last assigned was 30 (the last element)
      const seat = assignNextSeat(seatOrder, slotStart, slotEnd, [], 30)
      expect(seat).toBe(1)
    })

    it('throws 409 if all seats in the sequence are occupied', () => {
      const allOccupied = seatOrder.map((s) => ({ seatNumber: s }))
      expect(() => assignNextSeat(seatOrder, slotStart, slotEnd, allOccupied, 1)).toThrow(
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
    it('filters by morning preference and groups random slots by hour', async () => {
      // Future window: 2026-10-05 (Monday) to 2026-10-09 (Friday)
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
        'morning',
        '2026-10-05',
        mockTx
      )

      expect(result.recommendedDays.length).toBeGreaterThan(0)
      expect(result.recommendedDays.length).toBeLessThanOrEqual(4)

      // All hourly slots should be morning (hour < 12)
      for (const slot of result.hourlySlots) {
        expect(slot.hour).toBeLessThan(12)
        expect(slot.hour).toBeGreaterThanOrEqual(8)
      }

      // Should have distinct hours
      const hours = result.hourlySlots.map((s) => s.hour)
      const uniqueHours = new Set(hours)
      expect(hours.length).toBe(uniqueHours.size)
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
