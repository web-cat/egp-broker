import { describe, it, expect, vi, beforeEach } from 'vitest'
import studentRedemptionsPostHandler from '@@/server/api/me/students/[id]/redemptions.post'
import prisma from '@@/server/utils/db'
import { teacherForceRedeemPass } from '@@/server/utils/redemptions'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/redemptions', () => ({
  teacherForceRedeemPass: vi.fn()
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

describe('Teacher Force Redeem Pass API (POST /api/me/students/[id]/redemptions)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParamId = 'stu-1'
    mockUserSession = {
      user: { id: 'teacher-1', role: 'TEACHER', globalRole: 'USER' }
    }
  })

  it('throws 401 Unauthorized if user is not logged in', async () => {
    mockUserSession = { user: null }

    await expect(
      studentRedemptionsPostHandler({
        _body: {
          assignmentId: 'assign-1',
          passTypeId: 'pt-1'
        }
      } as any)
    ).rejects.toThrow('Unauthorized')
  })

  it('throws 403 Forbidden if user is not an instructor/admin in the course', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [] // no instructor enrollment
    } as any)

    await expect(
      studentRedemptionsPostHandler({
        _body: {
          assignmentId: 'assign-1',
          passTypeId: 'pt-1'
        }
      } as any)
    ).rejects.toThrow('Forbidden')
  })

  it('successfully executes force redemption and returns 200 with result', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER',
      enrollments: [{ courseId: 'course-1' }]
    } as any)

    const mockResult = {
      redemption: {
        id: 'red-1',
        poolId: 'pool-1',
        assignmentId: 'assign-1',
        cost: 1,
        availableFrom: '2026-09-22T12:00:00.000Z',
        dueDate: '2026-09-23T12:00:00.000Z',
        acceptUntil: '2026-09-23T12:00:00.000Z',
        canvasOverrideId: '999',
        createdAt: '2026-09-22T12:00:00.000Z'
      },
      passBalances: [
        {
          passTypeId: 'pt-1',
          passTypeName: 'Late Pass',
          balance: 2,
          initialBalance: 3
        }
      ]
    }

    vi.mocked(teacherForceRedeemPass).mockResolvedValue(mockResult as any)

    const response = await studentRedemptionsPostHandler({
      _body: {
        assignmentId: 'assign-1',
        passTypeId: 'pt-1',
        deductFromBalance: true,
        availableFrom: '2026-09-22T12:00:00.000Z',
        dueDate: '2026-09-23T12:00:00.000Z',
        acceptUntil: '2026-09-23T12:00:00.000Z'
      }
    } as any)

    expect(teacherForceRedeemPass).toHaveBeenCalledWith({
      userId: 'stu-1',
      courseId: 'course-1',
      instructorUserId: 'teacher-1',
      assignmentId: 'assign-1',
      passTypeId: 'pt-1',
      deductFromBalance: true,
      availableFrom: '2026-09-22T12:00:00.000Z',
      dueDate: '2026-09-23T12:00:00.000Z',
      acceptUntil: '2026-09-23T12:00:00.000Z'
    })
    expect(response).toEqual({
      statusCode: 200,
      data: mockResult
    })
  })
})
