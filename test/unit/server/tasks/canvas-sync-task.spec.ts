import { describe, it, expect, vi, beforeEach } from 'vitest'
import syncCanvasTask from '@@/server/tasks/sync/canvas'
import prisma from '@@/server/utils/db'
import { syncCourseRosterFromNrps } from '@@/server/utils/nrps'
import { syncCourseAssignmentsFromCanvas } from '@@/server/utils/canvas-sync'

vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/nrps', () => ({
  syncCourseRosterFromNrps: vi.fn()
}))

vi.mock('@@/server/utils/canvas-sync', () => ({
  syncCourseAssignmentsFromCanvas: vi.fn()
}))

describe('Nitro Task: sync:canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has valid task metadata', () => {
    expect(syncCanvasTask.meta).toEqual({
      name: 'sync:canvas',
      description: 'Synchronize assignments and course rosters from Canvas daily'
    })
  })

  it('syncs both roster and assignments for courses with an instructor Canvas API key', async () => {
    const mockCourses = [
      {
        id: 'course-1',
        title: 'Intro to CS',
        canvasCourseId: '1001',
        deployment: {
          platformId: 'plat-1'
        },
        enrollments: [
          {
            role: 'TEACHER',
            user: {
              ltiIdentities: [
                {
                  platformId: 'plat-1',
                  platformApiKey: 'inst-api-key-1'
                }
              ]
            }
          }
        ]
      }
    ]

    vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses as any)
    vi.mocked(syncCourseRosterFromNrps).mockResolvedValue({ success: true } as any)
    vi.mocked(syncCourseAssignmentsFromCanvas).mockResolvedValue({
      assignmentCount: 5,
      sectionCount: 2
    })

    const output = await (syncCanvasTask as any).run({ payload: {}, context: {} })

    expect(output.result).toBe('Success')
    expect(output.syncedCourses).toBe(1)
    expect(output.skippedCourses).toBe(0)
    expect(output.totalCourses).toBe(1)
    expect(output.errors).toEqual([])

    expect(syncCourseRosterFromNrps).toHaveBeenCalledWith('course-1')
    expect(syncCourseAssignmentsFromCanvas).toHaveBeenCalledWith('course-1', 'inst-api-key-1')
  })

  it('skips courses that do not have an instructor Canvas API key', async () => {
    const mockCourses = [
      {
        id: 'course-without-key',
        title: 'Math 101',
        canvasCourseId: '1002',
        deployment: {
          platformId: 'plat-1'
        },
        enrollments: [
          {
            role: 'TEACHER',
            user: {
              ltiIdentities: [
                {
                  platformId: 'plat-1',
                  platformApiKey: null
                }
              ]
            }
          }
        ]
      }
    ]

    vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses as any)

    const output = await (syncCanvasTask as any).run({ payload: {}, context: {} })

    expect(output.result).toBe('Success')
    expect(output.syncedCourses).toBe(0)
    expect(output.skippedCourses).toBe(1)
    expect(syncCourseRosterFromNrps).not.toHaveBeenCalled()
    expect(syncCourseAssignmentsFromCanvas).not.toHaveBeenCalled()
  })

  it('isolates errors if one course sync fails, allowing other courses to succeed', async () => {
    const mockCourses = [
      {
        id: 'failing-course',
        title: 'Failing Course',
        canvasCourseId: '1003',
        deployment: { platformId: 'plat-1' },
        enrollments: [
          {
            role: 'TEACHER',
            user: {
              ltiIdentities: [{ platformId: 'plat-1', platformApiKey: 'bad-key' }]
            }
          }
        ]
      },
      {
        id: 'successful-course',
        title: 'Successful Course',
        canvasCourseId: '1004',
        deployment: { platformId: 'plat-1' },
        enrollments: [
          {
            role: 'TEACHER',
            user: {
              ltiIdentities: [{ platformId: 'plat-1', platformApiKey: 'good-key' }]
            }
          }
        ]
      }
    ]

    vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses as any)
    vi.mocked(syncCourseRosterFromNrps)
      .mockRejectedValueOnce(new Error('Network error on NRPS'))
      .mockResolvedValueOnce({ success: true } as any)
    vi.mocked(syncCourseAssignmentsFromCanvas).mockResolvedValue({
      assignmentCount: 2,
      sectionCount: 1
    })

    const output = await (syncCanvasTask as any).run({ payload: {}, context: {} })

    expect(output.result).toBe('Partial Failure')
    expect(output.syncedCourses).toBe(1)
    expect(output.errors).toHaveLength(1)
    expect(output.errors[0]).toContain('Failing Course')
    expect(syncCourseAssignmentsFromCanvas).toHaveBeenCalledWith('successful-course', 'good-key')
  })
})
