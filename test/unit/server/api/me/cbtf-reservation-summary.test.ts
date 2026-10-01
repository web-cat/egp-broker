import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/cbtf-reservation-summary.get'
import prisma from '@@/server/utils/db'
import {
  getPrimaryCbtfFacility,
  getFacilityOperatingHoursForDate,
  generateAvailableSlotsForDate
} from '@@/server/utils/cbtf'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    enrollment: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    cbtfReservation: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    cbtfFacility: {
      findFirst: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/enrollments', () => ({
  getCurrentEnrollment: vi.fn().mockResolvedValue({
    id: 'en-1',
    userId: 'teacher-1',
    courseId: 'course-1',
    courseRole: 'TEACHER'
  })
}))

vi.mock('@@/server/utils/cbtf', () => ({
  autoExpirePastScheduledReservations: vi.fn().mockResolvedValue(0),
  toCbtfReservationDto: vi.fn(),
  getPrimaryCbtfFacility: vi.fn(),
  getFacilityTimezone: vi.fn().mockReturnValue('America/New_York'),
  getFacilityOperatingHoursForDate: vi.fn(),
  generateAvailableSlotsForDate: vi.fn()
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || { id: 'teacher-1', role: 'TEACHER' } })
)

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts,
    getRouterParam: vi.fn().mockReturnValue('asg-1')
  }
})

describe('GET /api/me/assignments/:id/cbtf-reservation-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculates completed, scheduled, and unscheduled student counts and percentages correctly when not schedulable', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'INSTRUCTOR'
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: false,
      scheduleWindowStart: null,
      scheduleWindowEnd: null,
      availableFrom: null,
      dueDate: null,
      acceptUntil: null,
      overrides: []
    } as any)

    // 4 enrolled students
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' },
      { userId: 'student-3' },
      { userId: 'student-4' }
    ] as any)

    // Reservations:
    // student-1: COMPLETED
    // student-2: SCHEDULED
    // student-3: CANCELLED (so unscheduled)
    // student-4: none (so unscheduled)
    vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([
      { userId: 'student-1', status: 'COMPLETED' },
      { userId: 'student-2', status: 'SCHEDULED' },
      { userId: 'student-3', status: 'CANCELLED' }
    ] as any)

    const event = { context: {} } as any
    const res = await handler(event)

    expect(res.statusCode).toBe(200)
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        role: 'STUDENT'
      },
      select: { userId: true }
    })
    expect(res.data).toEqual({
      totalEnrolledCount: 4,
      completedCount: 1,
      scheduledCount: 1,
      unscheduledCount: 2,
      completedPct: 25.0,
      scheduledPct: 25.0,
      unscheduledPct: 50.0,
      remainingOpenSlots: 0,
      remainingOpenSeats: 0,
      reservationWindowEnd: null
    })
  })

  it('calculates remaining open slots and open seats through the end of the reservation window', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'INSTRUCTOR'
    } as any)

    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const windowEndStr = futureDate.toISOString()

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: true,
      scheduleWindowStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
      scheduleWindowEnd: futureDate,
      availableFrom: null,
      dueDate: null,
      acceptUntil: null,
      overrides: []
    } as any)

    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' }
    ] as any)

    // Facility with 48 seats
    vi.mocked(getPrimaryCbtfFacility).mockResolvedValue({
      id: 'facility-1',
      name: 'Main CBTF Facility',
      totalSeats: 48,
      seatAllocationOrder: Array.from({ length: 48 }, (_, i) => i + 1),
      operatingHours: [],
      scheduleExceptions: []
    } as any)

    // prisma.cbtfReservation.findMany:
    // First call: assignment reservation query
    // Second call: facility active reservations query
    vi.mocked(prisma.cbtfReservation.findMany)
      .mockResolvedValueOnce([{ userId: 'student-1', status: 'SCHEDULED' }] as any)
      .mockResolvedValueOnce([])

    vi.mocked(getFacilityOperatingHoursForDate).mockResolvedValue({
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00',
      reason: null
    })

    const futureSlotStart = new Date(Date.now() + 60 * 60 * 1000) // 1 hr from now
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000)

    vi.mocked(generateAvailableSlotsForDate).mockReturnValue([
      {
        startTime: futureSlotStart,
        endTime: futureSlotEnd,
        arrivalsCount: 0,
        maxArrivals: 4,
        occupiedSeatsCount: 0,
        totalSeats: 48
      }
    ])

    const event = { context: {} } as any
    const res = await handler(event)

    expect(res.statusCode).toBe(200)
    expect(res.data.totalEnrolledCount).toBe(2)
    expect(res.data.scheduledCount).toBe(1)
    expect(res.data.unscheduledCount).toBe(1)
    expect(res.data.remainingOpenSlots).toBeGreaterThan(0)
    expect(res.data.remainingOpenSeats).toBeGreaterThan(0)
    expect(res.data.reservationWindowEnd).toBe(windowEndStr)
  })

  it('handles 0 enrolled students gracefully', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'INSTRUCTOR'
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([])
    vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])

    const event = { context: {} } as any
    const res = await handler(event)

    expect(res.statusCode).toBe(200)
    expect(res.data).toEqual({
      totalEnrolledCount: 0,
      completedCount: 0,
      scheduledCount: 0,
      unscheduledCount: 0,
      completedPct: 0,
      scheduledPct: 0,
      unscheduledPct: 0,
      remainingOpenSlots: 0,
      remainingOpenSeats: 0,
      reservationWindowEnd: null
    })
  })
})
