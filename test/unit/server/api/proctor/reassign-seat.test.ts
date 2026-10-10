import { describe, it, expect, vi, beforeEach } from 'vitest'
import reassignSeatPost from '../../../../../server/api/proctor/reassign-seat.post'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfReservation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/cbtf-canvas', () => ({
  syncCbtfReservationCanvasOverride: vi.fn().mockResolvedValue(true)
}))

let currentSessionUser: any = null
vi.stubGlobal('getUserSession', () => Promise.resolve({ user: currentSessionUser }))

describe('API: Proctor Reassign Seat Endpoint', () => {
  const mockEvent = (userRole: string | null = 'PROCTOR', body: any = {}) =>
    ({
      context: {
        user: userRole
          ? { id: 'proctor-1', firstName: 'Proctor', lastName: 'User', globalRole: userRole }
          : null
      },
      node: {
        req: { method: 'POST' },
        res: { setHeader: vi.fn(), getHeader: vi.fn() }
      },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR' }
  })

  describe('Authorization', () => {
    it('rejects unauthenticated user with 401', async () => {
      currentSessionUser = null
      const event = mockEvent(null, { reservationId: 'res-1', targetSeatNumber: 19 })
      await expect(reassignSeatPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects student (USER) with 403', async () => {
      currentSessionUser = { id: 'usr-1', globalRole: 'USER' }
      const event = mockEvent('USER', { reservationId: 'res-1', targetSeatNumber: 19 })
      await expect(reassignSeatPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('allows PROCTOR role', async () => {
      const mockRes = {
        id: 'res-1',
        facilityId: 'fac-1',
        seatNumber: 4,
        status: 'CHECKED_IN',
        startTime: new Date('2026-10-10T14:00:00.000Z'),
        endTime: new Date('2026-10-10T15:00:00.000Z'),
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Alice', lastName: 'Student' }
      }
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(mockRes as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        ...mockRes,
        seatNumber: 19
      } as any)

      const event = mockEvent('PROCTOR', { reservationId: 'res-1', targetSeatNumber: 19 })
      const res = await reassignSeatPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.seatNumber).toBe(19)
    })

    it('allows ADMIN role', async () => {
      currentSessionUser = { id: 'admin-1', globalRole: 'ADMIN' }
      const mockRes = {
        id: 'res-1',
        facilityId: 'fac-1',
        seatNumber: 4,
        status: 'SCHEDULED',
        startTime: new Date('2026-10-10T14:00:00.000Z'),
        endTime: new Date('2026-10-10T15:00:00.000Z'),
        assignment: { title: 'Midterm 1' },
        user: { firstName: 'Alice', lastName: 'Student' }
      }
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(mockRes as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        ...mockRes,
        seatNumber: 20
      } as any)

      const event = mockEvent('ADMIN', { reservationId: 'res-1', targetSeatNumber: 20 })
      const res = await reassignSeatPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.seatNumber).toBe(20)
    })
  })

  describe('Validation & Conflict Prevention', () => {
    it('throws 404 if reservation does not exist', async () => {
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(null)
      const event = mockEvent('PROCTOR', { reservationId: 'res-999', targetSeatNumber: 19 })

      await expect(reassignSeatPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404, statusMessage: 'Reservation not found' })
      )
    })

    it('throws 400 if reservation status is not SCHEDULED or CHECKED_IN', async () => {
      const mockRes = {
        id: 'res-1',
        facilityId: 'fac-1',
        seatNumber: 4,
        status: 'CHECKED_OUT',
        startTime: new Date('2026-10-10T14:00:00.000Z'),
        endTime: new Date('2026-10-10T15:00:00.000Z')
      }
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(mockRes as any)
      const event = mockEvent('PROCTOR', { reservationId: 'res-1', targetSeatNumber: 19 })

      await expect(reassignSeatPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: 'Cannot reassign seat for reservation with status \'CHECKED_OUT\''
        })
      )
    })

    it('throws 409 if target workstation is already occupied in overlapping window', async () => {
      const mockRes = {
        id: 'res-1',
        facilityId: 'fac-1',
        seatNumber: 4,
        status: 'CHECKED_IN',
        startTime: new Date('2026-10-10T14:00:00.000Z'),
        endTime: new Date('2026-10-10T15:00:00.000Z')
      }
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue(mockRes as any)
      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValue({
        id: 'res-conflict',
        seatNumber: 19,
        status: 'CHECKED_IN'
      } as any)

      const event = mockEvent('PROCTOR', { reservationId: 'res-1', targetSeatNumber: 19 })

      await expect(reassignSeatPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: 'Workstation Seat #19 is already occupied during this time window'
        })
      )
    })
  })
})
