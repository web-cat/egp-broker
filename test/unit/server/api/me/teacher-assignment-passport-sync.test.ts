import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/passport-sync.post'
import prisma from '@@/server/utils/db'
import { resyncAssignmentPassPortExtensions } from '@@/server/utils/passport'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'

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

vi.mock('@@/server/utils/passport', () => ({
  resyncAssignmentPassPortExtensions: vi.fn()
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || { id: 'teacher-1', role: 'TEACHER' } })
)

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts,
    getRouterParam: vi.fn().mockReturnValue('asg-1')
  }
})

describe('POST /api/me/assignments/:id/passport-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized users with 401', async () => {
    vi.stubGlobal('getUserSession', () => Promise.resolve({ user: null }))

    await expect(handler({ context: {} } as any)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
  })

  it('rejects students with 403', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'student-1', role: 'STUDENT' } })
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'student-1',
      currentCourseId: 'course-1',
      globalRole: 'STUDENT'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      id: 'en-1',
      userId: 'student-1',
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)

    await expect(handler({ context: {} } as any)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('successfully triggers resync and returns result for teacher', async () => {
    vi.stubGlobal('getUserSession', () =>
      Promise.resolve({ user: { id: 'teacher-1', role: 'TEACHER' } })
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'INSTRUCTOR'
    } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({
      id: 'en-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      role: 'TEACHER'
    } as any)
    vi.mocked(resyncAssignmentPassPortExtensions).mockResolvedValue({
      syncedCount: 3,
      failedCount: 0,
      totalCount: 3
    })

    const result = await handler({ context: {} } as any)

    expect(result).toEqual({
      statusCode: 200,
      data: {
        syncedCount: 3,
        failedCount: 0,
        totalCount: 3
      }
    })
    expect(resyncAssignmentPassPortExtensions).toHaveBeenCalledWith('asg-1')
  })
})
