import { describe, it, expect, vi, beforeEach } from 'vitest'
import reservationsGet from '../../../../../server/api/admin/cbtf/reservations.get'
import reservationPatch from '../../../../../server/api/admin/cbtf/reservations/[id].patch'
import reservationDelete from '../../../../../server/api/admin/cbtf/reservations/[id].delete'
import prisma from '@@/server/utils/db'
import {
  syncCbtfReservationCanvasOverride,
  deleteCbtfReservationCanvasOverride
} from '@@/server/utils/cbtf-canvas'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfReservation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/cbtf-canvas', () => ({
  syncCbtfReservationCanvasOverride: vi
    .fn()
    .mockResolvedValue({ status: 'updated', overrideId: 'override-123' }),
  deleteCbtfReservationCanvasOverride: vi.fn().mockResolvedValue(true)
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (handler: any) => handler,
    readBody: (event: any) => Promise.resolve(event._body || {}),
    getQuery: (event: any) => event._query || {},
    getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
    createError: (opts: any) => {
      const err = new Error(opts.statusMessage || 'Error') as any
      err.statusCode = opts.statusCode || 500
      err.statusMessage = opts.statusMessage
      return err
    }
  }
})

describe('Admin CBTF Reservations Endpoints', () => {
  const mockEvent = (userRole: string | null = 'ADMIN', body = {}, params = {}, query = {}) =>
    ({
      context: {
        user: userRole ? { id: 'admin-1', globalRole: userRole } : null,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body,
      _query: query
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/cbtf/reservations', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null)
      await expect(reservationsGet(event)).rejects.toThrow('Unauthorized')
    })

    it('throws 403 if not ADMIN', async () => {
      const event = mockEvent('STUDENT')
      await expect(reservationsGet(event)).rejects.toThrow('Forbidden')
    })

    it('defaults to next 50 upcoming reservations sorted asc by start time', async () => {
      const event = mockEvent('ADMIN')
      const mockList = [
        {
          id: 'res-1',
          facilityId: 'fac-1',
          assignmentId: 'asg-1',
          userId: 'usr-1',
          seatNumber: 12,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          status: 'SCHEDULED',
          canvasOverrideId: 'cov-1',
          assignment: { title: 'Exam 1' },
          user: {
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@vt.edu',
            studentId: '906111222',
            avatarUrl: null
          }
        }
      ]

      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue(mockList as any)

      const res = await reservationsGet(event)

      expect(res.statusCode).toBe(200)
      expect(res.data?.length).toBe(1)
      expect(res.data?.[0].studentEmail).toBe('alice@vt.edu')
      expect(res.pagination).toEqual({
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1
      })

      // Verify Prisma query was called with upcoming startTime filter and take 50
      expect(prisma.cbtfReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
          orderBy: { startTime: 'asc' },
          where: expect.objectContaining({
            startTime: expect.objectContaining({
              gte: expect.any(Date)
            })
          })
        })
      )
    })

    it('filters by search term (student name, email, student ID)', async () => {
      const event = mockEvent('ADMIN', {}, {}, { search: 'Smith' })
      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])

      await reservationsGet(event)

      expect(prisma.cbtfReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: {
              OR: [
                { firstName: { contains: 'Smith', mode: 'insensitive' } },
                { lastName: { contains: 'Smith', mode: 'insensitive' } },
                { email: { contains: 'Smith', mode: 'insensitive' } },
                { studentId: { contains: 'Smith', mode: 'insensitive' } }
              ]
            }
          })
        })
      )
    })

    it('filters by status and custom date range with pagination', async () => {
      const event = mockEvent(
        'ADMIN',
        {},
        {},
        {
          status: 'CHECKED_IN',
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-02T23:59:59.000Z',
          page: '2',
          pageSize: '25'
        }
      )

      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(60)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])

      const res = await reservationsGet(event)

      expect(res.pagination).toEqual({
        total: 60,
        page: 2,
        pageSize: 25,
        totalPages: 3
      })

      expect(prisma.cbtfReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 25,
          where: expect.objectContaining({
            status: 'CHECKED_IN',
            startTime: {
              gte: new Date('2026-10-01T00:00:00.000Z'),
              lte: new Date('2026-10-02T23:59:59.000Z')
            }
          })
        })
      )
    })
  })

  describe('PATCH /api/admin/cbtf/reservations/[id]', () => {
    it('throws 404 if reservation does not exist', async () => {
      const event = mockEvent('ADMIN', { status: 'CHECKED_IN' }, { id: 'missing-id' })
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(null)

      await expect(reservationPatch(event)).rejects.toThrow('Reservation not found')
    })

    it('updates time slot, seat, and invokes Canvas sync', async () => {
      const event = mockEvent(
        'ADMIN',
        {
          seatNumber: 15,
          startTime: '2026-10-10T14:00:00.000Z',
          endTime: '2026-10-10T15:00:00.000Z'
        },
        { id: 'res-1' }
      )

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        seatNumber: 10,
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        seatNumber: 15,
        startTime: new Date('2026-10-10T14:00:00.000Z'),
        endTime: new Date('2026-10-10T15:00:00.000Z'),
        status: 'SCHEDULED',
        assignment: { title: 'Exam 1' },
        user: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' }
      } as any)

      const res = await reservationPatch(event)

      expect(res.statusCode).toBe(200)
      expect(prisma.cbtfReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            seatNumber: 15,
            startTime: new Date('2026-10-10T14:00:00.000Z'),
            endTime: new Date('2026-10-10T15:00:00.000Z')
          })
        })
      )
      expect(syncCbtfReservationCanvasOverride).toHaveBeenCalledWith('res-1')
    })

    it('removes Canvas override when status is updated to CANCELLED', async () => {
      const event = mockEvent('ADMIN', { status: 'CANCELLED' }, { id: 'res-1' })

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CANCELLED',
        assignment: { title: 'Exam 1' },
        user: { firstName: 'Alice', lastName: 'Smith', email: 'alice@vt.edu' }
      } as any)

      const res = await reservationPatch(event)

      expect(res.statusCode).toBe(200)
      expect(deleteCbtfReservationCanvasOverride).toHaveBeenCalledWith('res-1')
    })
  })

  describe('DELETE /api/admin/cbtf/reservations/[id]', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null, {}, { id: 'res-1' })
      await expect(reservationDelete(event)).rejects.toThrow('Unauthorized')
    })

    it('throws 403 if not ADMIN', async () => {
      const event = mockEvent('TEACHER', {}, { id: 'res-1' })
      await expect(reservationDelete(event)).rejects.toThrow('Forbidden')
    })

    it('throws 404 if reservation does not exist', async () => {
      const event = mockEvent('ADMIN', {}, { id: 'res-missing' })
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(null)

      await expect(reservationDelete(event)).rejects.toThrow('Reservation not found')
    })

    it('deletes Canvas override before deleting reservation record', async () => {
      const event = mockEvent('ADMIN', {}, { id: 'res-1' })

      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        canvasOverrideId: 'cov-99'
      } as any)

      vi.mocked(prisma.cbtfReservation.delete).mockResolvedValue({
        id: 'res-1'
      } as any)

      const res = await reservationDelete(event)

      expect(res.statusCode).toBe(200)
      expect(deleteCbtfReservationCanvasOverride).toHaveBeenCalledWith('res-1')
      expect(prisma.cbtfReservation.delete).toHaveBeenCalledWith({
        where: { id: 'res-1' }
      })
    })
  })
})
