import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/gta-repair-timezone.post'
import prisma from '@@/server/utils/db'
import * as gtaRepairModule from '@@/server/utils/gta-repair-timezone'

vi.mock('@@/server/utils/db', () => ({
  default: {
    assignment: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/gta-repair-timezone', () => ({
  repairAssignmentGtaTimezones: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts,
    getRouterParam: vi.fn().mockReturnValue('asg-1')
  }
})

describe('POST /api/me/assignments/:id/gta-repair-timezone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 401 when user is not authenticated', async () => {
    vi.stubGlobal('getUserSession', () => Promise.resolve({ user: null }))

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('throws 404 when assignment is not found', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  })

  it('throws 400 when assignment does not have GTA interviews', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      hasInterviews: false
    } as any)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'This assignment is not configured for GTA grading interviews'
    })
  })

  it('throws 403 when user is neither an administrator nor enrolled as course teacher', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'user-1', globalRole: 'USER' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      hasInterviews: true
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      enrollments: []
    } as any)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden: Administrator or course teacher privileges required'
    })
  })

  it('successfully invokes repairAssignmentGtaTimezones for administrator', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      hasInterviews: true
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      enrollments: []
    } as any)

    const mockRepairResult = {
      totalChecked: 2,
      totalRepaired: 2,
      alreadyCorrect: 0,
      conflicts: 0,
      errors: 0,
      details: []
    }
    vi.mocked(gtaRepairModule.repairAssignmentGtaTimezones).mockResolvedValue(mockRepairResult)

    const res = await handler({} as any)
    expect(res.statusCode).toBe(200)
    expect(res.data).toEqual(mockRepairResult)
    expect(gtaRepairModule.repairAssignmentGtaTimezones).toHaveBeenCalledWith('asg-1', 'admin-1')
  })

  it('successfully invokes repairAssignmentGtaTimezones for course teacher', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', globalRole: 'USER' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      hasInterviews: true
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      enrollments: [{ courseId: 'course-1', role: 'TEACHER' }]
    } as any)

    const mockRepairResult = {
      totalChecked: 1,
      totalRepaired: 1,
      alreadyCorrect: 0,
      conflicts: 0,
      errors: 0,
      details: []
    }
    vi.mocked(gtaRepairModule.repairAssignmentGtaTimezones).mockResolvedValue(mockRepairResult)

    const res = await handler({} as any)
    expect(res.statusCode).toBe(200)
    expect(res.data).toEqual(mockRepairResult)
    expect(gtaRepairModule.repairAssignmentGtaTimezones).toHaveBeenCalledWith('asg-1', 'teacher-1')
  })
})
