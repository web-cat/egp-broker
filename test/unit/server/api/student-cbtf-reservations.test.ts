import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import studentCbtfReservationsGet from '@@/server/api/me/students/[id]/cbtf-reservations.get'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { getStudentCbtfReservations } from '@@/server/utils/teacher'
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
  getStudentCbtfReservations: vi.fn()
}))

vi.mock('@@/server/utils/gta-interview', () => ({
  assertCourseMember: vi.fn()
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Student CBTF Reservations Endpoint (GET /api/me/students/:id/cbtf-reservations)', () => {
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

  it('throws 401 if user is not authenticated', async () => {
    const event = mockEvent(null)
    await expect(studentCbtfReservationsGet(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('throws 400 if student id param is missing', async () => {
    const event = mockEvent({ id: 'teacher-1' }, { id: '' })
    await expect(studentCbtfReservationsGet(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Student ID is required'
    })
  })

  it('throws 403 if user is not an instructor or GTA', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)
    vi.mocked(assertCourseMember).mockResolvedValue({
      isInstructor: false,
      isGta: false
    } as any)

    const event = mockEvent()
    await expect(studentCbtfReservationsGet(event)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden: Graduate TA or Instructor role required'
    })
  })

  it('returns student CBTF reservations for instructor or GTA', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      courseId: 'course-1',
      role: 'TEACHER'
    } as any)
    vi.mocked(assertCourseMember).mockResolvedValue({
      isInstructor: true,
      isGta: false
    } as any)

    const mockReservations = [
      {
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'assign-1',
        assignmentTitle: 'Exam 1',
        userId: 'student-1',
        seatNumber: 12,
        startTime: '2026-09-25T14:00:00Z',
        endTime: '2026-09-25T15:00:00Z',
        status: 'SCHEDULED'
      }
    ]
    vi.mocked(getStudentCbtfReservations).mockResolvedValue(mockReservations as any)

    const event = mockEvent()
    const result = await studentCbtfReservationsGet(event)

    expect(getStudentCbtfReservations).toHaveBeenCalledWith('student-1', 'course-1')
    expect(result).toEqual({
      statusCode: 200,
      data: mockReservations
    })
  })
})
