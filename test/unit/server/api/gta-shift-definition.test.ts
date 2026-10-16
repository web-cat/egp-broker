import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import shiftDefinitionPut from '@@/server/api/me/courses/[courseId]/gtas/[id]/shift-definition.put'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Course GTA Shift Definition Endpoint (PUT /api/me/courses/:courseId/gtas/:id/shift-definition)', () => {
  const mockEvent = (
    user: any = { id: 'teacher-1', globalRole: 'USER' },
    params = { courseId: 'course-1', id: 'ta-1' },
    body = { shiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)' }
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'PUT' } },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
      readValidatedBody: async (event: any, validator: any) => validator(event._body),
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
    await expect(shiftDefinitionPut(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
  })

  it('throws 403 if user is not instructor or the GTA themselves', async () => {
    const event = mockEvent({ id: 'student-1', globalRole: 'USER' })
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'enr-s',
      userId: 'student-1',
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)

    await expect(shiftDefinitionPut(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('updates and returns the shift definition on the enrollment', async () => {
    const event = mockEvent()
    vi.mocked(prisma.enrollment.findUnique).mockImplementation(async ({ where }: any) => {
      if (where?.userId_courseId?.userId === 'ta-1') {
        return { id: 'enr-ta-1', userId: 'ta-1', courseId: 'course-1', role: 'TA' } as any
      }
      return { id: 'enr-t', userId: 'teacher-1', courseId: 'course-1', role: 'TEACHER' } as any
    })

    vi.mocked(prisma.enrollment.update).mockResolvedValue({
      id: 'enr-ta-1',
      userId: 'ta-1',
      courseId: 'course-1',
      role: 'TA',
      shiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)'
    } as any)

    const res = await shiftDefinitionPut(event)
    expect(res.statusCode).toBe(200)
    expect(res.data.shiftDefinition).toBe('Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)')
    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: {
        userId_courseId: {
          userId: 'ta-1',
          courseId: 'course-1'
        }
      },
      data: {
        shiftDefinition: 'Tue 2:00–5:00 PM (3.0h), Wed 2:30–5:00 PM (2.5h)'
      }
    })
  })
})
