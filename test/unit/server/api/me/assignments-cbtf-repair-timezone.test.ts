import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/cbtf-repair-timezone.post'
import prisma from '@@/server/utils/db'
import * as cbtfCanvasModule from '@@/server/utils/cbtf-canvas'

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

vi.mock('@@/server/utils/cbtf-canvas', () => ({
  repairAssignmentCbtfTimezones: vi.fn()
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

describe('POST /api/me/assignments/:id/cbtf-repair-timezone', () => {
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

  it('throws 403 when user is not an administrator', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', globalRole: 'USER' } })
    )

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden: Administrator privileges required'
    })
  })

  it('throws 404 when assignment does not exist', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  })

  it('throws 400 when assignment is not CBTF schedulable', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: false
    } as any)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Assignment is not configured for CBTF scheduling'
    })
  })

  it('successfully invokes repairAssignmentCbtfTimezones for administrator', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'admin-1', globalRole: 'ADMIN' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: true
    } as any)

    const mockRepairResult = {
      totalChecked: 52,
      totalRepaired: 44,
      seatsReassigned: 5,
      alreadyCorrect: 8,
      conflicts: 0,
      errors: 0,
      details: []
    }
    vi.mocked(cbtfCanvasModule.repairAssignmentCbtfTimezones).mockResolvedValue(mockRepairResult)

    const res = await handler({} as any)
    expect(res).toEqual({
      statusCode: 200,
      data: mockRepairResult
    })
    expect(cbtfCanvasModule.repairAssignmentCbtfTimezones).toHaveBeenCalledWith('asg-1', 'admin-1')
  })
})
