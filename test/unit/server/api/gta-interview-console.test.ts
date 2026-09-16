import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import feedGet from '@@/server/api/me/courses/[courseId]/interviews/index.get'
import interviewPatch from '@@/server/api/me/courses/[courseId]/interviews/[id].patch'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    },
    gtaInterviewReservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: GTA Interview Console Endpoints', () => {
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
      node: { req: { method: 'GET' } },
      _body: body,
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
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

  describe('GET /api/me/courses/:courseId/interviews (Feed)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const event = mockEvent(null)
      await expect(feedGet(event)).rejects.toThrowError(
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

      await expect(feedGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('returns reservations filtered by gtaId for TA role', async () => {
      const event = mockEvent({ id: 'gta-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        {
          id: 'res-1',
          gtaId: 'gta-1',
          studentId: 'student-1',
          status: 'SCHEDULED',
          startTime: new Date('2026-10-05T10:00:00.000Z'),
          student: { firstName: 'Bob', lastName: 'Student', email: 'bob@vt.edu' },
          assignment: { id: 'asg-1', title: 'Project 1' }
        }
      ] as any)

      const res = await feedGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveLength(1)
      expect(prisma.gtaInterviewReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignment: { courseId: 'course-1' },
            gtaId: 'gta-1'
          })
        })
      )
    })

    it('allows instructors to query all course reservations or filter by gtaId', async () => {
      const event = mockEvent(
        { id: 'prof-1', globalRole: 'USER' },
        {},
        { courseId: 'course-1' } as any,
        { gtaId: 'gta-2' }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'prof-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([] as any)

      const res = await feedGet(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaInterviewReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignment: { courseId: 'course-1' },
            gtaId: 'gta-2'
          })
        })
      )
    })
  })

  describe('PATCH /api/me/courses/:courseId/interviews/:id', () => {
    it('rejects updates if caller is a TA not assigned to the reservation', async () => {
      const event = mockEvent(
        { id: 'gta-other', globalRole: 'USER' },
        { status: 'CHECKED_IN' },
        { courseId: 'course-1', id: 'res-1' }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-other',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-assigned',
        status: 'SCHEDULED'
      } as any)

      await expect(interviewPatch(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('checks in student and sets checkedInAt timestamp', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { status: 'CHECKED_IN' },
        { courseId: 'course-1', id: 'res-1' }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CHECKED_IN',
        checkedInAt: new Date()
      } as any)

      const res = await interviewPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'CHECKED_IN',
            checkedInAt: expect.any(Date)
          })
        })
      )
    })

    it('completes interview with notes and sets checkedOutAt timestamp', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { status: 'COMPLETED', notes: 'Great explanation of memory allocator.' },
        { courseId: 'course-1', id: 'res-1' }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        status: 'CHECKED_IN'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'COMPLETED',
        notes: 'Great explanation of memory allocator.'
      } as any)

      const res = await interviewPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            notes: 'Great explanation of memory allocator.',
            checkedOutAt: expect.any(Date)
          })
        })
      )
    })

    it('allows marking student as no-show (MISSED)', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        { status: 'MISSED' },
        { courseId: 'course-1', id: 'res-1' }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'MISSED'
      } as any)

      const res = await interviewPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'MISSED'
          })
        })
      )
    })

    it('allows instructors to update reservation for any GTA in course', async () => {
      const event = mockEvent(
        { id: 'prof-1', globalRole: 'USER' },
        { status: 'CHECKED_OUT' },
        { courseId: 'course-1', id: 'res-1' }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'prof-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-other',
        status: 'CHECKED_IN'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CHECKED_OUT'
      } as any)

      const res = await interviewPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({
            status: 'CHECKED_OUT',
            checkedOutAt: expect.any(Date)
          })
        })
      )
    })
  })
})
