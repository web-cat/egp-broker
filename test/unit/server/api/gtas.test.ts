import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import gtasGet from '@@/server/api/me/courses/[courseId]/gtas.get'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Course GTAs Endpoint (GET /api/me/courses/:courseId/gtas)', () => {
  const mockEvent = (
    user: any = { id: 'teacher-1', globalRole: 'USER' },
    params = { courseId: 'course-1' }
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'GET' } }
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
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

  it('throws 401 if unauthenticated', async () => {
    const event = mockEvent(null)
    await expect(gtasGet(event)).rejects.toThrowError(expect.objectContaining({ statusCode: 401 }))
  })

  it('throws 403 if user is not enrolled in the course', async () => {
    const event = mockEvent({ id: 'stranger-1', globalRole: 'USER' })
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

    await expect(gtasGet(event)).rejects.toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('returns empty array if no TAs enrolled', async () => {
    const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'enr-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([])

    const res = await gtasGet(event)
    expect(res.statusCode).toBe(200)
    expect(res.data).toEqual([])
  })

  it('returns projected TA list for instructor', async () => {
    const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'enr-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      {
        id: 'enr-ta-1',
        userId: 'ta-1',
        courseId: 'course-1',
        role: 'TA',
        user: {
          id: 'ta-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.edu',
          avatarUrl: 'https://gravatar.com/alice'
        }
      },
      {
        id: 'enr-ta-2',
        userId: 'ta-2',
        courseId: 'course-1',
        role: 'TA',
        user: {
          id: 'ta-2',
          firstName: 'Bob',
          lastName: 'Taylor',
          email: 'bob@example.edu',
          avatarUrl: null
        }
      }
    ] as any)

    const res = await gtasGet(event)
    expect(res.statusCode).toBe(200)
    expect(res.data).toHaveLength(2)
    expect(res.data[0]).toEqual({
      id: 'ta-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.edu',
      avatarUrl: 'https://gravatar.com/alice'
    })
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId: 'course-1',
          role: 'TA'
        }
      })
    )
  })
})
