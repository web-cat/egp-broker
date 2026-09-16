import { describe, it, expect, vi, beforeEach } from 'vitest'
import proctorReservationsGet from '../../../../../server/api/proctor/reservations.get'
import proctorResyncCanvasPost from '../../../../../server/api/proctor/reservations/[id]/resync-canvas.post'
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
      update: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/cbtf-canvas', () => ({
  syncCbtfReservationCanvasOverride: vi.fn(),
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

describe('Proctor CBTF Reservations API', () => {
  const mockEvent = (userRole: string | null = 'PROCTOR', body = {}, params = {}, query = {}) =>
    ({
      context: {
        user: userRole ? { id: 'proctor-1', globalRole: userRole } : null,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body,
      _query: query
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/proctor/reservations', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null)
      await expect(proctorReservationsGet(event)).rejects.toThrow('Unauthorized')
    })

    it('throws 403 if role is STUDENT', async () => {
      const event = mockEvent('STUDENT')
      await expect(proctorReservationsGet(event)).rejects.toThrow('Forbidden')
    })

    it('allows PROCTOR role and returns next 50 upcoming reservations', async () => {
      const event = mockEvent('PROCTOR')
      const mockList = [
        {
          id: 'res-1',
          facilityId: 'fac-1',
          assignmentId: 'asg-1',
          userId: 'usr-1',
          seatNumber: 5,
          startTime: new Date(Date.now() + 1800000),
          endTime: new Date(Date.now() + 5400000),
          status: 'SCHEDULED',
          canvasOverrideId: null,
          assignment: { title: 'Midterm Exam' },
          user: {
            firstName: 'David',
            lastName: 'Miller',
            email: 'david@vt.edu',
            studentId: '906777111',
            avatarUrl: null
          }
        }
      ]

      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(1)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue(mockList as any)

      const res = await proctorReservationsGet(event)

      expect(res.statusCode).toBe(200)
      expect(res.data?.length).toBe(1)
      expect(res.data?.[0].studentName).toBe('David Miller')
      expect(res.pagination).toEqual({
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1
      })
    })

    it('allows ADMIN role to query proctor reservations', async () => {
      const event = mockEvent('ADMIN')
      vi.mocked(prisma.cbtfReservation.count).mockResolvedValue(0)
      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([])

      const res = await proctorReservationsGet(event)
      expect(res.statusCode).toBe(200)
    })
  })

  describe('POST /api/proctor/reservations/[id]/resync-canvas', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null, {}, { id: 'res-1' })
      await expect(proctorResyncCanvasPost(event)).rejects.toThrow('Unauthorized')
    })

    it('throws 403 if role is STUDENT', async () => {
      const event = mockEvent('STUDENT', {}, { id: 'res-1' })
      await expect(proctorResyncCanvasPost(event)).rejects.toThrow('Forbidden')
    })

    it('throws 404 if reservation does not exist', async () => {
      const event = mockEvent('PROCTOR', {}, { id: 'missing' })
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(null)

      await expect(proctorResyncCanvasPost(event)).rejects.toThrow('Reservation not found')
    })

    it('handles cancelled reservations by removing Canvas override', async () => {
      const event = mockEvent('PROCTOR', {}, { id: 'res-1' })
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        status: 'CANCELLED',
        assignment: { title: 'Exam 1' },
        user: { firstName: 'David', lastName: 'Miller' }
      } as any)

      const res = await proctorResyncCanvasPost(event)

      expect(res.statusCode).toBe(200)
      expect(deleteCbtfReservationCanvasOverride).toHaveBeenCalledWith('res-1')
      expect(res.message).toContain('cancelled')
    })

    it('resyncs Canvas override successfully when possible', async () => {
      const event = mockEvent('PROCTOR', {}, { id: 'res-1' })
      vi.mocked(prisma.cbtfReservation.findUnique)
        .mockResolvedValueOnce({
          id: 'res-1',
          status: 'SCHEDULED',
          assignment: { title: 'Exam 1' },
          user: { firstName: 'David', lastName: 'Miller', email: 'david@vt.edu' }
        } as any)
        .mockResolvedValueOnce({
          id: 'res-1',
          status: 'SCHEDULED',
          canvasOverrideId: 'cov-555',
          assignment: { title: 'Exam 1' },
          user: { firstName: 'David', lastName: 'Miller', email: 'david@vt.edu' }
        } as any)

      vi.mocked(syncCbtfReservationCanvasOverride).mockResolvedValue({
        status: 'created',
        overrideId: 'cov-555'
      })

      const res = await proctorResyncCanvasPost(event)

      expect(res.statusCode).toBe(200)
      expect(syncCbtfReservationCanvasOverride).toHaveBeenCalledWith('res-1')
      expect(res.message).toContain('Canvas override synced successfully')
      expect(res.data.canvasOverrideId).toBe('cov-555')
    })

    it('handles skipped Canvas sync (e.g. external tool) with informative warning', async () => {
      const event = mockEvent('PROCTOR', {}, { id: 'res-1' })
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        status: 'SCHEDULED',
        assignment: { title: 'Exam 1' },
        user: { firstName: 'David', lastName: 'Miller', email: 'david@vt.edu' }
      } as any)

      vi.mocked(syncCbtfReservationCanvasOverride).mockResolvedValue({
        status: 'skipped',
        reason: 'external_tool'
      })

      const res = await proctorResyncCanvasPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.warning).toBe(true)
      expect(res.message).toContain('external tool')
    })
  })
})
