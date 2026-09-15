import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/cbtf-sync-overrides.post'
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
  resyncAssignmentCbtfOverrides: vi.fn()
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

describe('POST /api/me/assignments/:id/cbtf-sync-overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 401 when session user is not authenticated', async () => {
    vi.stubGlobal('getUserSession', () => Promise.resolve({ user: null }))

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('throws 404 when assignment does not exist', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', globalRole: 'USER' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  })

  it('throws 400 when assignment is not CBTF schedulable', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', globalRole: 'USER' } })
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

  it('throws 403 when user is not teacher/TA/admin in the course', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'student-1', globalRole: 'USER' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: true
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'student-1',
      enrollments: []
    } as any)

    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  })

  it('successfully invokes resyncAssignmentCbtfOverrides for authorized teacher', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', globalRole: 'USER' } })
    )
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'asg-1',
      courseId: 'course-1',
      isSchedulable: true
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      enrollments: [{ role: 'TEACHER', courseId: 'course-1' }]
    } as any)

    const mockSyncResult = {
      totalChecked: 2,
      matched: 1,
      updated: 1,
      created: 0,
      changedOrCreated: 1,
      errors: 0,
      details: [
        { reservationId: 'res-1', studentName: 'Alice', status: 'matched' as const },
        { reservationId: 'res-2', studentName: 'Bob', status: 'updated' as const }
      ]
    }
    vi.mocked(cbtfCanvasModule.resyncAssignmentCbtfOverrides).mockResolvedValue(mockSyncResult)

    const res = await handler({} as any)
    expect(res).toEqual({
      statusCode: 200,
      data: mockSyncResult
    })
    expect(cbtfCanvasModule.resyncAssignmentCbtfOverrides).toHaveBeenCalledWith(
      'asg-1',
      'teacher-1'
    )
  })
})
