import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import patchCourseSettings from '../../../../server/api/me/courses/[courseId]/index.patch'
import patchAssignment from '../../../../server/api/me/assignments/[id].patch'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      update: vi.fn()
    },
    assignment: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/assignments', () => ({
  syncAssignmentEligibility: vi.fn().mockResolvedValue(undefined),
  setManualEligibilities: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: any) => handler,
    getRouterParam: vi.fn((event, param) => event.params?.[param]),
    readBody: vi.fn((event) => event.body || {}),
    readValidatedBody: vi.fn((event, validator) => validator(event.body || {})),
    createError: (opts: any) => opts
  }
})

const mockEvent = (
  user: any = { id: 'u1', globalRole: 'USER' },
  params: Record<string, string> = {},
  body: any = {}
) =>
  ({
    context: { user },
    params,
    body
  }) as unknown as H3Event

vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Teacher Course & Assignment GTA Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PATCH /api/me/courses/[courseId]', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null, { courseId: 'c1' }, { interviewLocation: 'McBryde 106' })
      try {
        await patchCourseSettings(event)
        expect.unreachable('Should have thrown')
      } catch (err: any) {
        expect(err.statusCode).toBe(401)
      }
    })

    it('throws 403 if user is not enrolled in the course', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

      const event = mockEvent(
        { id: 'u1', globalRole: 'USER' },
        { courseId: 'c1' },
        { interviewLocation: 'McBryde 106' }
      )

      try {
        await patchCourseSettings(event)
        expect.unreachable('Should have thrown')
      } catch (err: any) {
        expect(err.statusCode).toBe(403)
      }
    })

    it('throws 403 if user is a student or TA (not instructor/teacher)', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        courseId: 'c1',
        role: 'STUDENT'
      } as any)

      const event = mockEvent(
        { id: 'u1', globalRole: 'USER' },
        { courseId: 'c1' },
        { interviewLocation: 'McBryde 106' }
      )

      try {
        await patchCourseSettings(event)
        expect.unreachable('Should have thrown')
      } catch (err: any) {
        expect(err.statusCode).toBe(403)
        expect(err.statusMessage).toContain('Only instructors')
      }
    })

    it('updates interviewLocation when user is TEACHER in the course', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        courseId: 'c1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.course.update).mockResolvedValue({
        id: 'c1',
        title: 'CS 1114',
        label: 'CS1114',
        interviewLocation: 'McBryde 106'
      } as any)

      const event = mockEvent(
        { id: 'u1', globalRole: 'USER' },
        { courseId: 'c1' },
        { interviewLocation: '  McBryde 106  ' }
      )

      const response = await patchCourseSettings(event)
      expect(response.statusCode).toBe(200)
      expect(response.data.interviewLocation).toBe('McBryde 106')
      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { interviewLocation: 'McBryde 106' },
        select: {
          id: true,
          title: true,
          label: true,
          interviewLocation: true
        }
      })
    })

    it('clears interviewLocation when empty string is passed', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'e1',
        userId: 'u1',
        courseId: 'c1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.course.update).mockResolvedValue({
        id: 'c1',
        title: 'CS 1114',
        label: 'CS1114',
        interviewLocation: null
      } as any)

      const event = mockEvent(
        { id: 'u1', globalRole: 'USER' },
        { courseId: 'c1' },
        { interviewLocation: '   ' }
      )

      const response = await patchCourseSettings(event)
      expect(response.statusCode).toBe(200)
      expect(prisma.course.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { interviewLocation: null },
        select: expect.any(Object)
      })
    })
  })

  describe('PATCH /api/me/assignments/[id] - GTA Interview Fields', () => {
    it('updates hasInterviews and interview windows on assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        courseId: 'c1'
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1',
        enrollments: [{ courseId: 'c1', role: 'TEACHER' }]
      } as any)

      const windowStart = '2026-09-21T09:00:00.000Z'
      const windowEnd = '2026-09-25T17:00:00.000Z'

      vi.mocked(prisma.assignment.update).mockResolvedValue({
        id: 'a1',
        hasInterviews: true,
        interviewWindowStart: new Date(windowStart),
        interviewWindowEnd: new Date(windowEnd)
      } as any)

      const event = mockEvent(
        { id: 'u1', globalRole: 'USER' },
        { id: 'a1' },
        {
          hasInterviews: true,
          interviewWindowStart: windowStart,
          interviewWindowEnd: windowEnd
        }
      )

      const response = await patchAssignment(event)
      expect(response.statusCode).toBe(200)
      expect(prisma.assignment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({
          hasInterviews: true,
          interviewWindowStart: new Date(windowStart),
          interviewWindowEnd: new Date(windowEnd)
        })
      })
    })
  })
})
