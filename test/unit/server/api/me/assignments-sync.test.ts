import { describe, it, expect, vi, beforeEach } from 'vitest'
import syncPost from '../../../../../server/api/me/assignments/sync.post'
import prisma from '@@/server/utils/db'
import { fetchCanvasAssignments, fetchCanvasSections } from '@@/server/utils/canvas'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    ltiIdentity: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    ltiTool: {
      findMany: vi.fn()
    },
    courseSection: {
      upsert: vi.fn()
    },
    assignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
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
    },
    passType: {
      findMany: vi.fn()
    },
    passEligibility: {
      findMany: vi.fn()
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

describe('API: Me Assignments Sync (POST) with External Tool matching', () => {
  const mockSession = {
    user: {
      id: 'teacher-1',
      globalRole: 'USER'
    }
  }

  vi.stubGlobal('getUserSession', () => Promise.resolve(mockSession))

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      currentCourse: {
        id: 'course-1',
        canvasCourseId: '12345',
        deployment: {
          id: 'deploy-1',
          deploymentHost: 'canvas.example.edu',
          platform: {
            id: 'platform-1',
            issuer: 'https://canvas.example.edu',
            authEndpoint: '',
            tokenEndpoint: '',
            jwksEndpoint: ''
          }
        }
      }
    } as any)

    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.ltiIdentity.findUnique).mockResolvedValue({
      platformApiKey: 'valid-api-key'
    } as any)

    vi.mocked(fetchCanvasSections).mockResolvedValue([])
    vi.mocked(prisma.passRedemption.findMany).mockResolvedValue([])
    vi.mocked(prisma.assignment.findMany).mockResolvedValue([])
  })

  it('matches external tool and sets toolId and resourceLinkId on new assignment', async () => {
    vi.mocked(prisma.ltiTool.findMany).mockResolvedValue([
      { id: 'tool-cw', baseUrl: 'https://codeworkout.org' },
      { id: 'tool-webcat', baseUrl: 'https://web-cat.cs.vt.edu/Web-CAT' }
    ] as any)

    const canvasAssignments = [
      {
        id: 101,
        name: 'Project 1 (External Tool)',
        due_at: '2026-09-01T23:59:00Z',
        unlock_at: null,
        lock_at: null,
        published: true,
        submission_types: ['external_tool'],
        external_tool_tag_attributes: {
          url: 'https://codeworkout.org/lti/launch',
          resource_link_id: 'link-guid-101'
        }
      }
    ]

    vi.mocked(fetchCanvasAssignments).mockResolvedValue(canvasAssignments as any)
    vi.mocked(prisma.assignment.findFirst).mockResolvedValue(null) // Not found, create new
    vi.mocked(prisma.assignment.create).mockResolvedValue({
      id: 'asgn-new-1',
      title: 'Project 1 (External Tool)'
    } as any)

    const event = { context: {} } as any
    await syncPost(event)

    expect(prisma.assignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canvasAssignmentId: '101',
        title: 'Project 1 (External Tool)',
        toolId: 'tool-cw',
        resourceLinkId: 'link-guid-101'
      })
    })
  })

  it('updates existing assignment with matched toolId if previously null', async () => {
    vi.mocked(prisma.ltiTool.findMany).mockResolvedValue([
      { id: 'tool-webcat', baseUrl: 'https://web-cat.cs.vt.edu/Web-CAT' }
    ] as any)

    const canvasAssignments = [
      {
        id: 102,
        name: 'Web-CAT Assignment',
        due_at: '2026-09-10T23:59:00Z',
        unlock_at: null,
        lock_at: null,
        published: true,
        submission_types: ['external_tool'],
        external_tool_tag_attributes: {
          url: 'https://web-cat.cs.vt.edu/Web-CAT/WebObjects/Web-CAT.woa/wa/lti',
          resource_link_id: 'link-webcat-102'
        }
      }
    ]

    vi.mocked(fetchCanvasAssignments).mockResolvedValue(canvasAssignments as any)
    vi.mocked(prisma.assignment.findFirst).mockResolvedValue({
      id: 'asgn-existing-1',
      canvasAssignmentId: '102',
      toolId: null,
      resourceLinkId: null
    } as any)

    vi.mocked(prisma.assignment.update).mockResolvedValue({
      id: 'asgn-existing-1'
    } as any)

    const event = { context: {} } as any
    await syncPost(event)

    expect(prisma.assignment.update).toHaveBeenCalledWith({
      where: { id: 'asgn-existing-1' },
      data: expect.objectContaining({
        toolId: 'tool-webcat',
        resourceLinkId: 'link-webcat-102'
      })
    })
  })
})
