import { describe, it, expect, vi, beforeEach } from 'vitest'
import facilityGet from '../../../../../server/api/admin/cbtf/facility.get'
import facilityPatch from '../../../../../server/api/admin/cbtf/facility.patch'
import operatingHoursPost from '../../../../../server/api/admin/cbtf/operating-hours.post'
import operatingHoursDelete from '../../../../../server/api/admin/cbtf/operating-hours/[id].delete'
import exceptionsPost from '../../../../../server/api/admin/cbtf/exceptions.post'
import exceptionsDelete from '../../../../../server/api/admin/cbtf/exceptions/[id].delete'
import shiftsGet from '../../../../../server/api/admin/cbtf/shifts.get'
import shiftsPost from '../../../../../server/api/admin/cbtf/shifts.post'
import shiftsDelete from '../../../../../server/api/admin/cbtf/shifts/[id].delete'
import reservationsGet from '../../../../../server/api/admin/cbtf/reservations.get'
import reservationPatch from '../../../../../server/api/admin/cbtf/reservations/[id].patch'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfFacility: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    cbtfOperatingHours: {
      upsert: vi.fn(),
      delete: vi.fn()
    },
    cbtfScheduleException: {
      create: vi.fn(),
      delete: vi.fn()
    },
    cbtfProctorShift: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    cbtfReservation: {
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Admin CBTF Endpoints', () => {
  const mockEvent = (userRole: string | null = 'ADMIN', body = {}, params = {}) =>
    ({
      context: {
        user: userRole ? { id: 'admin-1', globalRole: userRole } : null,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
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
  })

  describe('Facility Settings', () => {
    it('throws 403 if user is not admin', async () => {
      const event = mockEvent('USER')
      await expect(facilityGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('returns facility data for admin', async () => {
      const event = mockEvent('ADMIN')
      const mockFacility = {
        id: 'fac-1',
        name: 'Main Facility',
        totalSeats: 48,
        seatAllocationOrder: [1, 2, 3],
        operatingHours: [],
        scheduleExceptions: []
      }
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue(mockFacility as any)

      const res = await facilityGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.id).toBe('fac-1')
    })

    it('updates facility seats and custom allocation order', async () => {
      const event = mockEvent('ADMIN', {
        name: 'Updated Facility',
        totalSeats: 24,
        seatAllocationOrder: [1, 13, 2, 14]
      })

      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({ id: 'fac-1' } as any)
      vi.mocked(prisma.cbtfFacility.update).mockResolvedValue({
        id: 'fac-1',
        name: 'Updated Facility',
        totalSeats: 24,
        seatAllocationOrder: [1, 13, 2, 14],
        operatingHours: [],
        scheduleExceptions: []
      } as any)

      const res = await facilityPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfFacility.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fac-1' },
          data: expect.objectContaining({
            totalSeats: 24,
            seatAllocationOrder: [1, 13, 2, 14]
          })
        })
      )
    })
  })

  describe('Operating Hours', () => {
    it('upserts operating hours for a day of week', async () => {
      const event = mockEvent('ADMIN', {
        facilityId: 'fac-1',
        dayOfWeek: 1,
        openTime: '08:00',
        closeTime: '18:00'
      })

      vi.mocked(prisma.cbtfOperatingHours.upsert).mockResolvedValue({
        id: 'oh-1',
        facilityId: 'fac-1',
        dayOfWeek: 1,
        openTime: '08:00',
        closeTime: '18:00'
      } as any)

      const res = await operatingHoursPost(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfOperatingHours.upsert).toHaveBeenCalled()
    })

    it('deletes operating hours entry', async () => {
      const event = mockEvent('ADMIN', {}, { id: 'oh-1' })
      vi.mocked(prisma.cbtfOperatingHours.delete).mockResolvedValue({ id: 'oh-1' } as any)

      const res = await operatingHoursDelete(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfOperatingHours.delete).toHaveBeenCalledWith({ where: { id: 'oh-1' } })
    })
  })

  describe('Schedule Exceptions', () => {
    it('creates schedule exception with isClosed: true', async () => {
      const event = mockEvent('ADMIN', {
        facilityId: 'fac-1',
        date: '2026-11-26',
        isClosed: true,
        reason: 'Thanksgiving'
      })

      vi.mocked(prisma.cbtfScheduleException.create).mockResolvedValue({
        id: 'ex-1',
        facilityId: 'fac-1',
        date: new Date('2026-11-26T00:00:00.000Z'),
        isClosed: true,
        reason: 'Thanksgiving'
      } as any)

      const res = await exceptionsPost(event)
      expect(res.statusCode).toBe(201)
      expect(prisma.cbtfScheduleException.create).toHaveBeenCalled()
    })

    it('deletes schedule exception', async () => {
      const event = mockEvent('ADMIN', {}, { id: 'ex-1' })
      vi.mocked(prisma.cbtfScheduleException.delete).mockResolvedValue({ id: 'ex-1' } as any)

      const res = await exceptionsDelete(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfScheduleException.delete).toHaveBeenCalledWith({ where: { id: 'ex-1' } })
    })
  })

  describe('Proctor Shifts', () => {
    it('fetches all proctor shifts', async () => {
      const event = mockEvent('ADMIN')
      vi.mocked(prisma.cbtfProctorShift.findMany).mockResolvedValue([
        {
          id: 'shift-1',
          userId: 'usr-p1',
          startTime: new Date('2026-10-05T08:00:00.000Z'),
          endTime: new Date('2026-10-05T12:00:00.000Z'),
          user: { firstName: 'Proctor', lastName: 'User', email: 'proctor@example.com' },
          facility: { name: 'Main Testing Center' }
        }
      ] as any)

      const res = await shiftsGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.length).toBe(1)
    })

    it('creates proctor shift', async () => {
      const event = mockEvent('ADMIN', {
        facilityId: 'fac-1',
        userId: 'usr-p1',
        startTime: '2026-10-05T08:00:00.000Z',
        endTime: '2026-10-05T12:00:00.000Z'
      })

      vi.mocked(prisma.cbtfProctorShift.create).mockResolvedValue({
        id: 'shift-1',
        facilityId: 'fac-1',
        userId: 'usr-p1',
        startTime: new Date('2026-10-05T08:00:00.000Z'),
        endTime: new Date('2026-10-05T12:00:00.000Z')
      } as any)

      const res = await shiftsPost(event)
      expect(res.statusCode).toBe(201)
      expect(prisma.cbtfProctorShift.create).toHaveBeenCalled()
    })

    it('deletes proctor shift', async () => {
      const event = mockEvent('ADMIN', {}, { id: 'shift-1' })
      vi.mocked(prisma.cbtfProctorShift.delete).mockResolvedValue({ id: 'shift-1' } as any)

      const res = await shiftsDelete(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfProctorShift.delete).toHaveBeenCalledWith({ where: { id: 'shift-1' } })
    })
  })

  describe('Reservations Audit & Management', () => {
    it('fetches reservations audit log', async () => {
      const event = mockEvent('ADMIN')
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([
        {
          id: 'res-1',
          facilityId: 'fac-1',
          assignmentId: 'asg-1',
          userId: 'usr-1',
          seatNumber: 10,
          startTime: new Date('2026-10-05T09:00:00.000Z'),
          endTime: new Date('2026-10-05T10:00:00.000Z'),
          status: 'SCHEDULED',
          assignment: { title: 'Midterm 1' },
          user: { firstName: 'Student', lastName: 'One', studentId: '906000001', avatarUrl: null }
        }
      ] as any)

      const res = await reservationsGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.length).toBe(1)
      expect(res.data[0].seatNumber).toBe(10)
    })

    it('updates reservation status', async () => {
      const event = mockEvent('ADMIN', { status: 'CANCELLED' }, { id: 'res-1' })
      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        userId: 'usr-1',
        seatNumber: 10,
        startTime: new Date('2026-10-05T09:00:00.000Z'),
        endTime: new Date('2026-10-05T10:00:00.000Z'),
        status: 'CANCELLED',
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Student', lastName: 'One', studentId: '906000001', avatarUrl: null }
      } as any)

      const res = await reservationPatch(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.status).toBe('CANCELLED')
    })
  })
})
