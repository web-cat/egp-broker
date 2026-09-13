import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncCourseAssignmentsFromCanvas } from '@@/server/utils/canvas-sync'
import prisma from '@@/server/utils/db'
import { fetchCanvasAssignments, fetchCanvasSections } from '@@/server/utils/canvas'

vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      findUnique: vi.fn()
    },
    ltiIdentity: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    enrollment: {
      updateMany: vi.fn()
    },
    ltiTool: {
      findMany: vi.fn()
    },
    courseSection: {
      upsert: vi.fn()
    },
    assignment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    passRedemption: {
      findMany: vi.fn()
    },
    assignmentOverride: {
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    assignmentOverrideStudent: {
      deleteMany: vi.fn(),
      upsert: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/canvas', () => ({
  fetchCanvasAssignments: vi.fn(),
  fetchCanvasSections: vi.fn(),
  fetchCanvasAssignmentOverrides: vi.fn(),
  getPlatformCanvasDomain: vi.fn(() => 'canvas.example.edu')
}))

vi.mock('@@/server/utils/assignments', async () => {
  const actual = await vi.importActual('@@/server/utils/assignments')
  return {
    ...actual,
    syncAssignmentEligibility: vi.fn()
  }
})

describe('Utility: syncCourseAssignmentsFromCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      id: 'course-1',
      canvasCourseId: 'canvas-101',
      deployment: {
        id: 'deploy-1',
        deploymentHost: 'canvas.example.edu',
        platform: {
          id: 'platform-1',
          issuer: 'https://canvas.example.edu'
        }
      }
    } as any)

    vi.mocked(fetchCanvasSections).mockResolvedValue([])
    vi.mocked(prisma.ltiTool.findMany).mockResolvedValue([])
    vi.mocked(prisma.passRedemption.findMany).mockResolvedValue([])
  })

  it('throws error if course is missing or LTI platform config is absent', async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null)

    await expect(syncCourseAssignmentsFromCanvas('missing-id', 'api-key')).rejects.toThrow(
      /Course context or LTI configuration missing/
    )
  })

  it('persists published: false when Canvas returns an unpublished assignment', async () => {
    vi.mocked(fetchCanvasAssignments).mockResolvedValue([
      {
        id: 999,
        name: 'Unpublished Homework',
        due_at: '2026-10-01T23:59:00Z',
        unlock_at: null,
        lock_at: null,
        published: false,
        submission_types: ['online_upload']
      }
    ] as any)

    vi.mocked(prisma.assignment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.assignment.create).mockResolvedValue({ id: 'asgn-999' } as any)

    const result = await syncCourseAssignmentsFromCanvas('course-1', 'api-key')

    expect(result.assignmentCount).toBe(1)
    expect(prisma.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canvasAssignmentId: '999',
        title: 'Unpublished Homework',
        published: false
      })
    })
  })

  it('persists published: true and updates existing assignment', async () => {
    vi.mocked(fetchCanvasAssignments).mockResolvedValue([
      {
        id: 999,
        name: 'Now Published Homework',
        due_at: '2026-10-01T23:59:00Z',
        unlock_at: null,
        lock_at: null,
        published: true,
        submission_types: ['online_upload']
      }
    ] as any)

    vi.mocked(prisma.assignment.findFirst).mockResolvedValue({
      id: 'asgn-999',
      canvasAssignmentId: '999',
      published: false
    } as any)
    vi.mocked(prisma.assignment.update).mockResolvedValue({ id: 'asgn-999' } as any)

    const result = await syncCourseAssignmentsFromCanvas('course-1', 'api-key')

    expect(result.assignmentCount).toBe(1)
    expect(prisma.assignment.update).toHaveBeenCalledWith({
      where: { id: 'asgn-999' },
      data: expect.objectContaining({
        title: 'Now Published Homework',
        published: true
      })
    })
  })
})
