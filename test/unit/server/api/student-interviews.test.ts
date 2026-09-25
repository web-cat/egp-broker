import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import studentInterviewsGet from '@@/server/api/me/students/[id]/interviews.get'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { getStudentInterviewHistory } from '@@/server/utils/teacher'
import { assertCourseMember } from '@@/server/utils/gta-interview'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/enrollments', () => ({
  getCurrentEnrollment: vi.fn()
}))

vi.mock('@@/server/utils/teacher', () => ({
  getStudentInterviewHistory: vi.fn()
}))

vi.mock('@@/server/utils/gta-interview', () => ({
  assertCourseMember: vi.fn()
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Student Interviews History Endpoint (GET /api/me/students/:id/interviews)', () => {
  const mockEvent = (
    user: any = { id: 'teacher-1', globalRole: 'USER' },
    params = { id: 'student-1' },
    query: Record<string, string> = {}
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'GET' } },
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
      getQuery: (event: any) => event._query || {},
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

  it('throws 401 if unauthenticated', async () => {
    const event = mockEvent(null)
    await expect(studentInterviewsGet(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 401, statusMessage: 'Unauthorized' })
    )
  })

  it('throws 400 if student id is missing', async () => {
    const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' }, { id: '' })
    await expect(studentInterviewsGet(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 400, statusMessage: 'Student ID is required' })
    )
  })

  it('throws 403 if user has no enrollment and is not admin', async () => {
    const event = mockEvent()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue(null)

    await expect(studentInterviewsGet(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403, statusMessage: 'Forbidden' })
    )
  })

  it('throws 403 if user is not instructor or GTA in the course', async () => {
    const event = mockEvent()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'student-99',
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)
    vi.mocked(assertCourseMember).mockResolvedValue({
      userId: 'student-99',
      user: { id: 'student-99' },
      courseRole: 'STUDENT',
      isInstructor: false,
      isGta: false
    } as any)

    await expect(studentInterviewsGet(event)).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 403,
        statusMessage: 'Forbidden: Graduate TA or Instructor role required'
      })
    )
  })

  it('successfully returns interview history for instructor', async () => {
    const event = mockEvent(
      { id: 'teacher-1', globalRole: 'USER' },
      { id: 'student-1' },
      { courseId: 'course-1' }
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      courseId: 'course-1',
      role: 'TEACHER'
    } as any)
    vi.mocked(assertCourseMember).mockResolvedValue({
      userId: 'teacher-1',
      user: { id: 'teacher-1' },
      courseRole: 'TEACHER',
      isInstructor: true,
      isGta: false
    } as any)

    const mockHistory = [
      {
        id: 'res-1',
        assignmentId: 'asg-1',
        assignmentTitle: 'Project 1',
        gtaId: 'gta-1',
        gtaName: 'Alice Smith',
        gtaEmail: 'alice@example.com',
        startTime: '2026-09-25T14:00:00.000Z',
        endTime: '2026-09-25T14:15:00.000Z',
        status: 'COMPLETED',
        checkedInAt: '2026-09-25T14:00:00.000Z',
        checkedOutAt: '2026-09-25T14:15:00.000Z',
        notes: 'Passed',
        createdAt: '2026-09-24T10:00:00.000Z'
      }
    ]
    vi.mocked(getStudentInterviewHistory).mockResolvedValue(mockHistory as any)

    const response = await studentInterviewsGet(event)
    expect(response.statusCode).toBe(200)
    expect(response.data).toEqual(mockHistory)
    expect(getStudentInterviewHistory).toHaveBeenCalledWith('student-1', 'course-1')
  })
})
