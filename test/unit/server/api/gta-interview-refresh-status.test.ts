import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import singleRefreshPost from '@@/server/api/me/courses/[courseId]/interviews/[id]/refresh-status.post'
import batchRefreshPost from '@@/server/api/me/courses/[courseId]/interviews/refresh-status.post'
import {
  refreshReservationSubmissionStatus,
  refreshBatchReservationSubmissionStatus
} from '@@/server/utils/passport'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    },
    gtaInterviewReservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/passport', () => ({
  refreshReservationSubmissionStatus: vi.fn(),
  refreshBatchReservationSubmissionStatus: vi.fn()
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: GTA Interview Submission Status Refresh Endpoints', () => {
  const mockEvent = (
    user: any = { id: 'gta-1', globalRole: 'USER' },
    body = {},
    params = { courseId: 'course-1', id: 'res-1' },
    query = {}
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'POST' } },
      _body: body,
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
      readValidatedBody: (event: any, validator: any) => {
        try {
          return validator(event._body || {})
        } catch (err: any) {
          throw Object.assign(new Error(err.message || 'Validation error'), {
            statusCode: 400,
            statusMessage: err.message || 'Bad Request',
            data: err
          })
        }
      },
      getQuery: (event: any) => event._query || {},
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

  describe('POST /api/me/courses/:courseId/interviews/:id/refresh-status (Single)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const event = mockEvent(null)
      await expect(singleRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects student requests with 403', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-student',
        userId: 'student-1',
        courseId: 'course-1',
        role: 'STUDENT'
      } as any)

      await expect(singleRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('throws 404 if reservation does not exist in the course', async () => {
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

      await expect(singleRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('rejects GTA attempting to refresh another GTA interview with 403', async () => {
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-other',
        assignmentId: 'asg-1'
      } as any)

      await expect(singleRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('allows GTA to refresh their assigned interview and returns updated data', async () => {
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        assignmentId: 'asg-1'
      } as any)

      const mockUpdated = {
        id: 'res-1',
        submissionStatus: { latestSubmissionUrl: 'https://tool.com/sub/1' },
        submissionStatusCheckedAt: new Date()
      }
      vi.mocked(refreshReservationSubmissionStatus).mockResolvedValue(mockUpdated as any)

      const res = await singleRefreshPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockUpdated)
      expect(refreshReservationSubmissionStatus).toHaveBeenCalledWith('res-1')
    })

    it('allows Instructor to refresh any interview in the course', async () => {
      const event = mockEvent({ id: 'instructor-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-inst',
        userId: 'instructor-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-2',
        assignmentId: 'asg-1'
      } as any)

      const mockUpdated = {
        id: 'res-1',
        submissionStatus: null,
        submissionStatusCheckedAt: new Date()
      }
      vi.mocked(refreshReservationSubmissionStatus).mockResolvedValue(mockUpdated as any)

      const res = await singleRefreshPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockUpdated)
      expect(refreshReservationSubmissionStatus).toHaveBeenCalledWith('res-1')
    })
  })

  describe('POST /api/me/courses/:courseId/interviews/refresh-status (Batch)', () => {
    it('rejects student requests with 403', async () => {
      const event = mockEvent(
        { id: 'student-1', globalRole: 'USER' },
        { reservationIds: ['res-1'] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-student',
        userId: 'student-1',
        courseId: 'course-1',
        role: 'STUDENT'
      } as any)

      await expect(batchRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('rejects empty reservationIds array with 400', async () => {
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' }, { reservationIds: [] })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      await expect(batchRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('rejects reservationIds array exceeding 20 items with 400', async () => {
      const ids = Array.from({ length: 21 }, (_, i) => `res-${i}`)
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' }, { reservationIds: ids })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      await expect(batchRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('throws 404 when some requested reservations are not in the course', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { reservationIds: ['res-1', 'res-2'] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        { id: 'res-1', gtaId: 'gta-1' }
      ] as any)

      await expect(batchRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('rejects GTA with 403 if any requested reservation is assigned to another GTA', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { reservationIds: ['res-1', 'res-2'] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        { id: 'res-1', gtaId: 'gta-1' },
        { id: 'res-2', gtaId: 'gta-other' }
      ] as any)

      await expect(batchRefreshPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('allows GTA to batch refresh their own reservations', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { reservationIds: ['res-1', 'res-2'] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-gta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        { id: 'res-1', gtaId: 'gta-1' },
        { id: 'res-2', gtaId: 'gta-1' }
      ] as any)

      const mockBatchResult = [
        { id: 'res-1', submissionStatus: { latestSubmissionUrl: 'url-1' } },
        { id: 'res-2', submissionStatus: { latestSubmissionUrl: 'url-2' } }
      ]
      vi.mocked(refreshBatchReservationSubmissionStatus).mockResolvedValue(mockBatchResult as any)

      const res = await batchRefreshPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockBatchResult)
      expect(refreshBatchReservationSubmissionStatus).toHaveBeenCalledWith(['res-1', 'res-2'])
    })

    it('allows Instructor to batch refresh any reservations in the course', async () => {
      const event = mockEvent(
        { id: 'instructor-1', globalRole: 'USER' },
        { reservationIds: ['res-1', 'res-2'] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-inst',
        userId: 'instructor-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)
      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        { id: 'res-1', gtaId: 'gta-1' },
        { id: 'res-2', gtaId: 'gta-2' }
      ] as any)

      const mockBatchResult = [
        { id: 'res-1', submissionStatus: null },
        { id: 'res-2', submissionStatus: null }
      ]
      vi.mocked(refreshBatchReservationSubmissionStatus).mockResolvedValue(mockBatchResult as any)

      const res = await batchRefreshPost(event)

      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual(mockBatchResult)
      expect(refreshBatchReservationSubmissionStatus).toHaveBeenCalledWith(['res-1', 'res-2'])
    })
  })
})
