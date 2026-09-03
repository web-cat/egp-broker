import { describe, it, expect, vi, beforeEach } from 'vitest'
import availabilityGet from '../../../../../server/api/me/cbtf/availability.get'
import reservationsGet from '../../../../../server/api/me/cbtf/reservations.get'
import reservationsPost from '../../../../../server/api/me/cbtf/reservations.post'
import reservationPatch from '../../../../../server/api/me/cbtf/reservations/[id].patch'
import reservationDelete from '../../../../../server/api/me/cbtf/reservations/[id].delete'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    cbtfReservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    cbtfFacility: { findFirst: vi.fn(), create: vi.fn() },
    cbtfScheduleException: { findFirst: vi.fn() },
    cbtfOperatingHours: { findUnique: vi.fn() },
    passRedemption: { findFirst: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma))
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: CBTF Student Reservation Endpoints', () => {
  const mockEvent = (
    user: any = { id: 'usr-1', globalRole: 'USER' },
    query = {},
    body = {},
    routerParams = {}
  ) =>
    ({
      context: { user, params: routerParams },
      node: { req: { method: 'GET' } },
      _query: query,
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      getQuery: (event: any) => event._query || {},
      readBody: (event: any) => Promise.resolve(event._body || {}),
      getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue(null)
  })

  describe('GET /api/me/cbtf/availability', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null)
      await expect(availabilityGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('throws 400 if assignment is not schedulable', async () => {
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        { assignmentId: 'clh1234567890123456789012' }
      )
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        isSchedulable: false
      } as any)

      await expect(availabilityGet(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: 'Assignment is not configured for CBTF scheduling'
        })
      )
    })

    it('returns availability recommendations for schedulable assignment', async () => {
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        { assignmentId: 'clh1234567890123456789012', timeOfDayPreference: 'morning' }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        courseId: 'course-1',
        title: 'Midterm 1',
        isSchedulable: true,
        scheduleWindowStart: new Date('2026-10-01T00:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-10-15T00:00:00.000Z')
      } as any)

      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: 'enr-1' } as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])

      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        name: 'Main Testing Center',
        totalSeats: 48,
        seatAllocationOrder: [1, 2, 3, 4],
        operatingHours: [{ dayOfWeek: 1, openTime: '08:00', closeTime: '17:00' }],
        scheduleExceptions: []
      } as any)

      vi.mocked(prisma.cbtfScheduleException.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfOperatingHours.findUnique).mockResolvedValue({
        openTime: '08:00',
        closeTime: '17:00'
      } as any)

      const response = await availabilityGet(event)
      expect(response.statusCode).toBe(200)
      expect(response.data.assignmentTitle).toBe('Midterm 1')
      expect(response.data.activeReservation).toBeNull()
      expect(Array.isArray(response.data.recommendedDays)).toBe(true)
    })
  })

  describe('GET /api/me/cbtf/reservations', () => {
    it('returns student reservations mapped to DTOs', async () => {
      const event = mockEvent({ id: 'usr-1', globalRole: 'USER' })
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([
        {
          id: 'res-1',
          facilityId: 'fac-1',
          assignmentId: 'asg-1',
          userId: 'usr-1',
          seatNumber: 3,
          startTime: new Date('2026-10-05T09:00:00.000Z'),
          endTime: new Date('2026-10-05T10:00:00.000Z'),
          status: 'SCHEDULED',
          assignment: { title: 'Midterm Exam' },
          user: { firstName: 'Demo', lastName: 'User', studentId: '906000001', avatarUrl: null },
          checkedInAt: null,
          checkedOutAt: null,
          checkedInByUserId: null,
          checkedOutByUserId: null
        }
      ] as any)

      const response = await reservationsGet(event)
      expect(response.statusCode).toBe(200)
      expect(response.data.length).toBe(1)
      expect(response.data[0].seatNumber).toBe(3)
      expect(response.data[0].assignmentTitle).toBe('Midterm Exam')
    })
  })

  describe('POST /api/me/cbtf/reservations', () => {
    it('rejects slot not aligned to 5-minute boundary', async () => {
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime: '2026-10-05T09:03:00.000Z' // 03 is not multiple of 5
        }
      )

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: expect.stringContaining('5-minute boundary')
        })
      )
    })

    it('rejects double booking on identical assignment', async () => {
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime: '2026-10-05T09:15:00.000Z'
        }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        courseId: 'course-1',
        isSchedulable: true,
        scheduleWindowStart: new Date('2026-10-01T00:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-10-15T00:00:00.000Z')
      } as any)
      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: 'enr-1' } as any)

      // Existing active reservation found
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValueOnce({
        id: 'res-existing',
        status: 'SCHEDULED'
      } as any)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: expect.stringContaining('already have an active reservation')
        })
      )
    })

    it('rejects booking when start time is in the past', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString()
      // Align with 5-minute boundary in the past
      const pastDate = new Date(pastTime)
      pastDate.setUTCMinutes(Math.floor(pastDate.getUTCMinutes() / 5) * 5, 0, 0)

      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime: pastDate.toISOString()
        }
      )

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: 'Cannot schedule a reservation in the past'
        })
      )
    })

    it('rejects booking when student has overlapping reservation for another assignment', async () => {
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime: '2026-10-05T09:15:00.000Z'
        }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        courseId: 'course-1',
        isSchedulable: true
      } as any)
      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: 'enr-1' } as any)

      // First call (existingActive for this assignment): null
      // Second call (conflictingSlot for any assignment): found conflicting reservation
      vi.mocked(prisma.cbtfReservation.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'res-other',
          assignmentId: 'other-asg',
          assignment: { title: 'Midterm 2' }
        } as any)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: expect.stringContaining('overlapping this time slot')
        })
      )
    })

    it('rejects booking when arrival throttle limit is reached', async () => {
      const startTime = '2026-10-05T09:15:00.000Z'
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime
        }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        courseId: 'course-1',
        isSchedulable: true,
        scheduleWindowStart: new Date('2026-10-01T00:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-10-15T00:00:00.000Z')
      } as any)
      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: 'enr-1' } as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValueOnce(null) // no existing for student

      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        totalSeats: 48, // max arrivals = 4
        seatAllocationOrder: [1, 2, 3, 4]
      } as any)

      vi.mocked(prisma.cbtfScheduleException.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfOperatingHours.findUnique).mockResolvedValue({
        openTime: '08:00',
        closeTime: '17:00'
      } as any)

      // Throttle limit: count returns 4 concurrent arrivals
      vi.mocked(prisma.cbtfReservation.count).mockResolvedValueOnce(4)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: expect.stringContaining('Arrival capacity reached')
        })
      )
    })

    it('successfully books reservation and returns DTO with assigned seat', async () => {
      const startTime = '2026-10-05T09:15:00.000Z'
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        {
          assignmentId: 'clh1234567890123456789012',
          startTime
        }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'clh1234567890123456789012',
        courseId: 'course-1',
        isSchedulable: true,
        scheduleWindowStart: new Date('2026-10-01T00:00:00.000Z'),
        scheduleWindowEnd: new Date('2026-10-15T00:00:00.000Z')
      } as any)
      vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: 'enr-1' } as any)
      vi.mocked(prisma.cbtfReservation.findFirst)
        .mockResolvedValueOnce(null) // no active for student
        .mockResolvedValueOnce(null) // no last reservation for seat order

      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        totalSeats: 48,
        seatAllocationOrder: [1, 15, 29, 2]
      } as any)

      vi.mocked(prisma.cbtfScheduleException.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfOperatingHours.findUnique).mockResolvedValue({
        openTime: '08:00',
        closeTime: '17:00'
      } as any)

      vi.mocked(prisma.cbtfReservation.count).mockResolvedValueOnce(1) // 1 arrival < 4 max
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValueOnce([]) // no active overlapping

      vi.mocked(prisma.cbtfReservation.create).mockResolvedValue({
        id: 'res-new',
        facilityId: 'fac-1',
        assignmentId: 'clh1234567890123456789012',
        userId: 'usr-1',
        seatNumber: 1,
        startTime: new Date(startTime),
        endTime: new Date('2026-10-05T10:15:00.000Z'),
        status: 'SCHEDULED',
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Demo', lastName: 'User', studentId: '906000001', avatarUrl: null },
        checkedInAt: null,
        checkedOutAt: null,
        checkedInByUserId: null,
        checkedOutByUserId: null
      } as any)

      const response = await reservationsPost(event)
      expect(response.statusCode).toBe(201)
      expect(response.data.id).toBe('res-new')
      expect(response.data.seatNumber).toBe(1)
      expect(response.data.status).toBe('SCHEDULED')
    })
  })

  describe('PATCH /api/me/cbtf/reservations/[id]', () => {
    it('reschedules a missed reservation to a new slot', async () => {
      const newStartTime = '2026-10-06T11:00:00.000Z'
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        { startTime: newStartTime },
        { id: 'res-1' }
      )

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        userId: 'usr-1',
        status: 'MISSED',
        assignment: {
          id: 'asg-1',
          scheduleWindowStart: new Date('2026-10-01T00:00:00.000Z'),
          scheduleWindowEnd: new Date('2026-10-15T00:00:00.000Z')
        }
      } as any)

      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        totalSeats: 48,
        seatAllocationOrder: [1, 2, 3]
      } as any)

      vi.mocked(prisma.cbtfScheduleException.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfOperatingHours.findUnique).mockResolvedValue({
        openTime: '08:00',
        closeTime: '17:00'
      } as any)

      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(0)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue(null)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        userId: 'usr-1',
        seatNumber: 1,
        startTime: new Date(newStartTime),
        endTime: new Date('2026-10-06T12:00:00.000Z'),
        status: 'SCHEDULED',
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Demo', lastName: 'User', studentId: '906000001', avatarUrl: null },
        checkedInAt: null,
        checkedOutAt: null,
        checkedInByUserId: null,
        checkedOutByUserId: null
      } as any)

      const response = await reservationPatch(event)
      expect(response.statusCode).toBe(200)
      expect(response.data.status).toBe('SCHEDULED')
      expect(response.data.startTime).toBe(newStartTime)
    })

    it('rejects rescheduling when new start time is in the past', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString()
      const pastDate = new Date(pastTime)
      pastDate.setUTCMinutes(Math.floor(pastDate.getUTCMinutes() / 5) * 5, 0, 0)

      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        { startTime: pastDate.toISOString() },
        { id: 'res-1' }
      )

      await expect(reservationPatch(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: 'Cannot reschedule to a time slot in the past'
        })
      )
    })

    it('rejects rescheduling when new time conflicts with student another active reservation', async () => {
      const newStartTime = '2026-10-06T11:00:00.000Z'
      const event = mockEvent(
        { id: 'usr-1', globalRole: 'USER' },
        {},
        { startTime: newStartTime },
        { id: 'res-1' }
      )

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        userId: 'usr-1',
        status: 'SCHEDULED',
        assignment: { title: 'Midterm 1' }
      } as any)

      // Conflict with another reservation
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValueOnce({
        id: 'res-conflict',
        assignmentId: 'asg-2',
        assignment: { title: 'Quiz 2' }
      } as any)

      await expect(reservationPatch(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: expect.stringContaining('overlapping this time slot')
        })
      )
    })
  })

  describe('DELETE /api/me/cbtf/reservations/[id]', () => {
    it('cancels scheduled reservation', async () => {
      const event = mockEvent({ id: 'usr-1', globalRole: 'USER' }, {}, {}, { id: 'res-1' })

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        userId: 'usr-1',
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        userId: 'usr-1',
        seatNumber: 1,
        startTime: new Date('2026-10-06T11:00:00.000Z'),
        endTime: new Date('2026-10-06T12:00:00.000Z'),
        status: 'CANCELLED',
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Demo', lastName: 'User', studentId: '906000001', avatarUrl: null },
        checkedInAt: null,
        checkedOutAt: null,
        checkedInByUserId: null,
        checkedOutByUserId: null
      } as any)

      const response = await reservationDelete(event)
      expect(response.statusCode).toBe(200)
      expect(response.data.status).toBe('CANCELLED')
    })
  })
})
