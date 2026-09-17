import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import { resyncAssignmentPassPortExtensions } from '@@/server/utils/passport'

vi.mock('@@/server/utils/overrides', () => ({
  resolveStudentEffectiveDates: vi.fn().mockResolvedValue({
    availableFrom: null,
    dueDate: new Date('2026-09-10T23:59:00.000Z'),
    acceptUntil: null,
    overrideType: 'NONE',
    overrideTitle: null
  })
}))

vi.mock('@@/server/utils/db', () => ({
  default: {
    assignment: {
      findUnique: vi.fn()
    },
    passRedemption: {
      findMany: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    randomUUID: () => 'mock-uuid-1234'
  }
})

describe('resyncAssignmentPassPortExtensions', () => {
  const mockTool = {
    id: 'tool-webcat',
    name: 'Web-CAT',
    supportsPassport: true,
    passportRegistrationStatus: 'REGISTERED',
    passportExtensionUrl: 'https://webcat.org/api/passport/v1/extension',
    passportClientId: 'client-123',
    passportClientSecret: 'secret-456',
    passportRequestedProperties: ['email']
  }

  const mockAssignment = {
    id: 'asgn-1',
    title: 'Program 1',
    courseId: 'course-1',
    resourceLinkId: 'link-123',
    canvasAssignmentId: 'canvas-asgn-99',
    toolId: 'tool-webcat',
    tool: mockTool,
    course: {
      id: 'course-1',
      title: 'CS 1114',
      deployment: {
        deploymentHost: 'canvas.vt.edu',
        platform: {
          issuer: 'https://canvas.vt.edu',
          name: 'Canvas'
        }
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global fetch / $fetch
    globalThis.$fetch = vi.fn().mockResolvedValue({ status: 'ok' }) as any
  })

  it('throws 404 when assignment is not found', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

    await expect(resyncAssignmentPassPortExtensions('invalid-id')).rejects.toThrowError(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('throws 400 when assignment has no tool or tool does not support PassPort', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      tool: null
    } as any)

    await expect(resyncAssignmentPassPortExtensions('asgn-1')).rejects.toThrowError(
      expect.objectContaining({ statusCode: 400 })
    )

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      tool: { ...mockTool, supportsPassport: false }
    } as any)

    await expect(resyncAssignmentPassPortExtensions('asgn-1')).rejects.toThrowError(
      expect.objectContaining({ statusCode: 400 })
    )
  })

  it('throws 502 when tool registration status is not REGISTERED or credentials are missing', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      tool: { ...mockTool, passportRegistrationStatus: 'PENDING' }
    } as any)

    await expect(resyncAssignmentPassPortExtensions('asgn-1')).rejects.toThrowError(
      expect.objectContaining({ statusCode: 502 })
    )
  })

  it('returns zero counts and does not send requests when no redemptions exist', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)
    vi.mocked(prisma.passRedemption.findMany).mockResolvedValue([])

    const result = await resyncAssignmentPassPortExtensions('asgn-1')

    expect(result).toEqual({
      syncedCount: 0,
      failedCount: 0,
      totalCount: 0
    })
    expect(globalThis.$fetch).not.toHaveBeenCalled()
  })

  it('resends all redemptions in sequence and returns success counts', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)

    const mockRedemptions = [
      {
        id: 'red-1',
        availableFrom: null,
        dueDate: null,
        acceptUntil: new Date('2026-09-12T23:59:00.000Z'),
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
        pool: {
          userId: 'user-1',
          passType: { name: '24-Hour Extension' },
          user: {
            id: 'user-1',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@vt.edu',
            ltiIdentities: [{ ltiSub: 'sub-jane', platformId: 'plat-1' }]
          }
        }
      },
      {
        id: 'red-2',
        availableFrom: null,
        dueDate: null,
        acceptUntil: new Date('2026-09-13T23:59:00.000Z'),
        createdAt: new Date('2026-09-09T10:00:00.000Z'),
        pool: {
          userId: 'user-2',
          passType: { name: '24-Hour Extension' },
          user: {
            id: 'user-2',
            firstName: 'John',
            lastName: 'Smith',
            email: 'john@vt.edu',
            ltiIdentities: []
          }
        }
      }
    ]

    vi.mocked(prisma.passRedemption.findMany).mockResolvedValue(mockRedemptions as any)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ role: 'STUDENT' } as any)

    const result = await resyncAssignmentPassPortExtensions('asgn-1')

    expect(result).toEqual({
      syncedCount: 2,
      failedCount: 0,
      totalCount: 2
    })
    expect(globalThis.$fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.$fetch).toHaveBeenCalledWith(
      'https://webcat.org/api/passport/v1/extension',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          extension: expect.objectContaining({
            new_due_date: '2026-09-12T23:59:00.000Z',
            new_accept_until: '2026-09-12T23:59:00.000Z'
          })
        })
      })
    )
  })
})
