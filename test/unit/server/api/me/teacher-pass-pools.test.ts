import { describe, it, expect, vi, beforeEach } from 'vitest'
import passPoolsPatchHandler from '../../../../../server/api/me/students/[id]/pass-pools.patch'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    },
    passType: {
      findMany: vi.fn()
    },
    studentPassPool: {
      upsert: vi.fn(),
      findMany: vi.fn()
    },
    $transaction: vi.fn((operations) => Promise.all(operations))
  }
}))

let mockUserSession: any = {
  user: { id: 'teacher-1', role: 'TEACHER', globalRole: 'USER' }
}

vi.stubGlobal('getUserSession', () => Promise.resolve(mockUserSession))

let routerParamId = 'stu-1'

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => {
      const err = new Error(opts.statusMessage)
      Object.assign(err, opts)
      return err
    },
    getRouterParam: vi.fn(() => routerParamId),
    readValidatedBody: vi.fn((event: any, validator: (data: any) => any) => validator(event._body))
  }
})

describe('Teacher Pass Pools PATCH API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParamId = 'stu-1'
    mockUserSession = {
      user: { id: 'teacher-1', role: 'TEACHER', globalRole: 'USER' }
    }
  })

  it('successfully updates student pass pools and returns updated balances', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [{ courseId: 'course-1' }]
    } as any)

    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'en-stu-1',
      userId: 'stu-1',
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)

    vi.mocked(prisma.passType.findMany).mockResolvedValue([
      { id: 'pt-1', name: 'Late Day', initialBalance: 3 },
      { id: 'pt-2', name: 'Quiz Retry', initialBalance: 1 }
    ] as any)

    vi.mocked(prisma.studentPassPool.upsert).mockResolvedValue({
      id: 'pool-1',
      userId: 'stu-1',
      passTypeId: 'pt-1',
      balance: 5
    } as any)

    vi.mocked(prisma.studentPassPool.findMany).mockResolvedValue([
      { id: 'pool-1', userId: 'stu-1', passTypeId: 'pt-1', balance: 5 },
      { id: 'pool-2', userId: 'stu-1', passTypeId: 'pt-2', balance: 1 }
    ] as any)

    const event = {
      _body: {
        balances: [{ passTypeId: 'pt-1', balance: 5 }]
      }
    }

    const res = await passPoolsPatchHandler(event as any)

    expect(res.statusCode).toBe(200)
    expect(res.data).toEqual([
      { passTypeId: 'pt-1', passTypeName: 'Late Day', balance: 5, initialBalance: 3 },
      { passTypeId: 'pt-2', passTypeName: 'Quiz Retry', balance: 1, initialBalance: 1 }
    ])
    expect(prisma.studentPassPool.upsert).toHaveBeenCalledWith({
      where: {
        userId_passTypeId: {
          userId: 'stu-1',
          passTypeId: 'pt-1'
        }
      },
      create: {
        userId: 'stu-1',
        passTypeId: 'pt-1',
        balance: 5
      },
      update: {
        balance: 5
      }
    })
  })

  it('rejects with 401 when no session is present', async () => {
    mockUserSession = {}
    const event = { _body: { balances: [{ passTypeId: 'pt-1', balance: 2 }] } }

    await expect(passPoolsPatchHandler(event as any)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('rejects with 403 when user is not authorized for the course', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'student-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [] // No teacher enrollment
    } as any)

    const event = { _body: { balances: [{ passTypeId: 'pt-1', balance: 2 }] } }

    await expect(passPoolsPatchHandler(event as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  })

  it('rejects with 404 when student is not enrolled in the course', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [{ courseId: 'course-1' }]
    } as any)

    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

    const event = { _body: { balances: [{ passTypeId: 'pt-1', balance: 2 }] } }

    await expect(passPoolsPatchHandler(event as any)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Student is not enrolled in this course'
    })
  })

  it('rejects with 400 when pass type does not belong to course', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [{ courseId: 'course-1' }]
    } as any)

    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'en-1',
      userId: 'stu-1',
      courseId: 'course-1'
    } as any)

    vi.mocked(prisma.passType.findMany).mockResolvedValue([
      { id: 'pt-1', name: 'Late Day', initialBalance: 3 }
    ] as any)

    const event = {
      _body: {
        balances: [{ passTypeId: 'pt-other-course', balance: 2 }]
      }
    }

    await expect(passPoolsPatchHandler(event as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Pass type pt-other-course does not belong to this course'
    })
  })

  it('rejects with validation error when balance is negative', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [{ courseId: 'course-1' }]
    } as any)

    const event = {
      _body: {
        balances: [{ passTypeId: 'pt-1', balance: -1 }]
      }
    }

    await expect(passPoolsPatchHandler(event as any)).rejects.toThrow()
  })
})
