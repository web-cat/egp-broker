import { describe, it, expect, vi, beforeEach } from 'vitest'
import statusGet from '../../../../../server/api/proctor/status.get'
import statusPatch from '../../../../../server/api/proctor/status.patch'
import feedGet from '../../../../../server/api/proctor/feed.get'
import lookupGet from '../../../../../server/api/proctor/lookup.get'
import checkInPost from '../../../../../server/api/proctor/check-in.post'
import checkOutPost from '../../../../../server/api/proctor/check-out.post'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    cbtfFacility: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    cbtfReservation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    user: {
      findFirst: vi.fn()
    },
    cbtfReservationNote: {
      count: vi.fn().mockResolvedValue(0)
    }
  }
}))

let currentSessionUser: any = null
vi.stubGlobal('getUserSession', () => Promise.resolve({ user: currentSessionUser }))
vi.stubGlobal('setUserSession', (_event: any, newSession: any) => {
  currentSessionUser = newSession.user
  return Promise.resolve()
})

describe('API: Proctor Operations Endpoints', () => {
  const mockEvent = (userRole: string | null = 'PROCTOR', query = {}, body = {}) =>
    ({
      context: {
        user: userRole
          ? { id: 'proctor-1', firstName: 'Proctor', lastName: 'User', globalRole: userRole }
          : null
      },
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
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR', isOnDuty: false }
  })

  describe('Authorization', () => {
    it('rejects unauthenticated user with 401', async () => {
      currentSessionUser = null
      const event = mockEvent(null)
      await expect(statusGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects student (USER) with 403', async () => {
      currentSessionUser = { id: 'usr-1', globalRole: 'USER' }
      const event = mockEvent('USER')
      await expect(feedGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('allows ADMIN to access proctor endpoints', async () => {
      currentSessionUser = { id: 'admin-1', globalRole: 'ADMIN' }
      const event = mockEvent('ADMIN')
      const res = await statusGet(event)
      expect(res.statusCode).toBe(200)
    })
  })

  describe('Duty Status', () => {
    it('gets duty status', async () => {
      currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR', isOnDuty: true }
      const event = mockEvent('PROCTOR')
      const res = await statusGet(event)
      expect(res.data.isOnDuty).toBe(true)
    })

    it('toggles duty status', async () => {
      currentSessionUser = { id: 'proctor-1', globalRole: 'PROCTOR', isOnDuty: false }
      const event = mockEvent('PROCTOR', {}, { isOnDuty: true })
      const res = await statusPatch(event)
      expect(res.data.isOnDuty).toBe(true)
      expect(currentSessionUser.isOnDuty).toBe(true)
    })
  })

  describe('Live Feed', () => {
    it('returns facility capacity and grouped rosters', async () => {
      const now = new Date()
      const mockFacility = {
        id: 'fac-1',
        name: 'Main CBTF',
        totalSeats: 48,
        checkInLeadMinutes: 5,
        checkInGraceMinutes: 15
      }
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue(mockFacility as any)

      vi.mocked(prisma.cbtfReservation.findMany).mockResolvedValue([
        {
          id: 'res-seated',
          facilityId: 'fac-1',
          assignmentId: 'asg-1',
          userId: 'usr-1',
          seatNumber: 12,
          startTime: new Date(now.getTime() - 20 * 60000),
          endTime: new Date(now.getTime() + 40 * 60000),
          status: 'CHECKED_IN',
          assignment: { title: 'Midterm 1' },
          user: { firstName: 'Alice', lastName: 'A', studentId: '906000001', avatarUrl: null }
        },
        {
          id: 'res-arriving',
          facilityId: 'fac-1',
          assignmentId: 'asg-2',
          userId: 'usr-2',
          seatNumber: 14,
          startTime: new Date(now.getTime() + 5 * 60000),
          endTime: new Date(now.getTime() + 65 * 60000),
          status: 'SCHEDULED',
          assignment: { title: 'Quiz 2' },
          user: { firstName: 'Bob', lastName: 'B', studentId: '906000002', avatarUrl: null }
        }
      ] as any)

      const event = mockEvent('PROCTOR')
      const res = await feedGet(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.counts.seated).toBe(1)
      expect(res.data.counts.arriving).toBe(1)
      expect(res.data.seated[0].seatNumber).toBe(12)
      expect(res.data.seated[0].elapsedMinutes).toBeGreaterThanOrEqual(19)
      expect(res.data.facility.occupiedSeats).toBe(1)
      expect(res.data.facility.availableSeats).toBe(47)
    })
  })

  describe('Student Card Swipe Lookup', () => {
    it('returns STUDENT_NOT_FOUND when ID does not match any user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      const event = mockEvent('PROCTOR', { studentId: '999999999' })
      const res = await lookupGet(event)

      expect(res.data.found).toBe(false)
      expect(res.data.decision).toBe('STUDENT_NOT_FOUND')
    })

    it('returns READY_FOR_CHECKOUT when student is already seated', async () => {
      const mockUser = {
        id: 'usr-1',
        firstName: 'Alice',
        lastName: 'A',
        studentId: '906000001',
        email: 'alice@example.com',
        avatarUrl: null
      }
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        checkInLeadMinutes: 5,
        checkInGraceMinutes: 15
      } as any)

      vi.mocked(prisma.cbtfReservation.findFirst).mockResolvedValueOnce({
        id: 'res-seated',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        userId: 'usr-1',
        seatNumber: 12,
        startTime: new Date('2026-10-05T09:00:00.000Z'),
        endTime: new Date('2026-10-05T10:00:00.000Z'),
        status: 'CHECKED_IN',
        assignment: { title: 'Midterm 1' }
      } as any)

      const event = mockEvent('PROCTOR', { studentId: '906000001' })
      const res = await lookupGet(event)

      expect(res.data.found).toBe(true)
      expect(res.data.decision).toBe('READY_FOR_CHECKOUT')
      expect(res.data.reservation.seatNumber).toBe(12)
    })

    it('returns READY_FOR_CHECKIN when student arrives within allowed window', async () => {
      const now = new Date()
      const mockUser = {
        id: 'usr-2',
        firstName: 'Bob',
        lastName: 'B',
        studentId: '906000002',
        email: 'bob@example.com',
        avatarUrl: null
      }
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        checkInLeadMinutes: 5,
        checkInGraceMinutes: 15
      } as any)

      // No seated reservation
      vi.mocked(prisma.cbtfReservation.findFirst)
        .mockResolvedValueOnce(null)
        // Scheduled reservation starting in 3 minutes (within 5 min lead)
        .mockResolvedValueOnce({
          id: 'res-arriving',
          facilityId: 'fac-1',
          assignmentId: 'asg-2',
          userId: 'usr-2',
          seatNumber: 15,
          startTime: new Date(now.getTime() + 3 * 60000),
          endTime: new Date(now.getTime() + 63 * 60000),
          status: 'SCHEDULED',
          assignment: { title: 'Quiz 2' }
        } as any)

      const event = mockEvent('PROCTOR', { studentId: '906000002' })
      const res = await lookupGet(event)

      expect(res.data.found).toBe(true)
      expect(res.data.decision).toBe('READY_FOR_CHECKIN')
      expect(res.data.reservation.seatNumber).toBe(15)
    })

    it('returns EARLY when student arrives more than lead allowance prior to test', async () => {
      const now = new Date()
      const mockUser = {
        id: 'usr-3',
        firstName: 'Charlie',
        lastName: 'C',
        studentId: '906000003',
        email: 'charlie@example.com',
        avatarUrl: null
      }
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        checkInLeadMinutes: 5,
        checkInGraceMinutes: 15
      } as any)

      // No seated reservation
      vi.mocked(prisma.cbtfReservation.findFirst)
        .mockResolvedValueOnce(null)
        // Scheduled reservation starting in 25 minutes (lead allowance is 5)
        .mockResolvedValueOnce({
          id: 'res-future',
          facilityId: 'fac-1',
          assignmentId: 'asg-3',
          userId: 'usr-3',
          seatNumber: 20,
          startTime: new Date(now.getTime() + 25 * 60000),
          endTime: new Date(now.getTime() + 85 * 60000),
          status: 'SCHEDULED',
          assignment: { title: 'Final Exam' }
        } as any)

      const event = mockEvent('PROCTOR', { studentId: '906000003' })
      const res = await lookupGet(event)

      expect(res.data.decision).toBe('EARLY')
      expect(res.data.leadMinutes).toBe(5)
    })

    it('returns LATE when student arrives after grace period', async () => {
      const now = new Date()
      const mockUser = {
        id: 'usr-4',
        firstName: 'Dave',
        lastName: 'D',
        studentId: '906000004',
        email: 'dave@example.com',
        avatarUrl: null
      }
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.cbtfFacility.findFirst).mockResolvedValue({
        id: 'fac-1',
        checkInLeadMinutes: 5,
        checkInGraceMinutes: 15
      } as any)

      // No seated reservation
      vi.mocked(prisma.cbtfReservation.findFirst)
        .mockResolvedValueOnce(null)
        // Scheduled reservation started 25 minutes ago (grace allowance is 15)
        .mockResolvedValueOnce({
          id: 'res-past',
          facilityId: 'fac-1',
          assignmentId: 'asg-4',
          userId: 'usr-4',
          seatNumber: 8,
          startTime: new Date(now.getTime() - 25 * 60000),
          endTime: new Date(now.getTime() + 35 * 60000),
          status: 'SCHEDULED',
          assignment: { title: 'Exam 1' }
        } as any)

      const event = mockEvent('PROCTOR', { studentId: '906000004' })
      const res = await lookupGet(event)

      expect(res.data.decision).toBe('LATE')
      expect(res.data.graceMinutes).toBe(15)
    })
  })

  describe('Check-In & Check-Out Execution', () => {
    it('checks in reservation and records proctor user ID', async () => {
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        status: 'SCHEDULED',
        seatNumber: 10,
        assignment: { title: 'Midterm' },
        user: { firstName: 'Alice', lastName: 'A', studentId: '906000001', avatarUrl: null }
      } as any)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CHECKED_IN',
        seatNumber: 10,
        checkedInAt: new Date(),
        checkedInByUserId: 'proctor-1',
        assignment: { title: 'Midterm' },
        user: { firstName: 'Alice', lastName: 'A', studentId: '906000001', avatarUrl: null }
      } as any)

      const event = mockEvent('PROCTOR', {}, { reservationId: 'res-1' })
      const res = await checkInPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.status).toBe('CHECKED_IN')
      expect(prisma.cbtfReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'CHECKED_IN',
            checkedInByUserId: 'proctor-1'
          })
        })
      )
    })

    it('checks out reservation and records proctor user ID', async () => {
      vi.mocked(prisma.cbtfReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        status: 'CHECKED_IN',
        seatNumber: 10,
        assignment: { title: 'Midterm' },
        user: { firstName: 'Alice', lastName: 'A', studentId: '906000001', avatarUrl: null }
      } as any)

      vi.mocked(prisma.cbtfReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CHECKED_OUT',
        seatNumber: 10,
        checkedOutAt: new Date(),
        checkedOutByUserId: 'proctor-1',
        assignment: { title: 'Midterm' },
        user: { firstName: 'Alice', lastName: 'A', studentId: '906000001', avatarUrl: null }
      } as any)

      const event = mockEvent('PROCTOR', {}, { reservationId: 'res-1' })
      const res = await checkOutPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data.status).toBe('CHECKED_OUT')
      expect(prisma.cbtfReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'CHECKED_OUT',
            checkedOutByUserId: 'proctor-1'
          })
        })
      )
    })
  })
})
