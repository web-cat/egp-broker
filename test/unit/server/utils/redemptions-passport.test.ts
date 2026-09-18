import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redeemPass } from '../../../../server/utils/redemptions'
import prisma from '@@/server/utils/db'
import { notifyPassRedemption, notifyPassPortSyncFailure } from '@@/server/services/alert.service'
import {
  buildPassPortExtensionPayload,
  sendPassPortExtension,
  sendPassPortRollback
} from '@@/server/utils/passport'

vi.mock('@@/server/services/alert.service', () => ({
  notifyPassRedemption: vi.fn().mockResolvedValue(true),
  notifyPassPortSyncFailure: vi.fn().mockResolvedValue(true)
}))

vi.mock('@@/server/utils/passport', () => ({
  buildPassPortExtensionPayload: vi.fn().mockReturnValue({
    request_id: 'mock-req-uuid-1234',
    context: {
      lms_instance_guid: 'lms.vt.edu',
      issuer: 'https://canvas.vt.edu',
      lti_context_id: 'ctx-123'
    },
    user: {
      lti_user_id: 'sub-456'
    },
    resource: {
      lti_resource_link_id: 'res-789'
    },
    extension: {
      pass_type: 'Extension Pass',
      original_available_from: null,
      new_available_from: null,
      original_due_date: '2026-09-10T23:59:00.000Z',
      new_due_date: null,
      original_accept_until: '2026-09-10T23:59:00.000Z',
      new_accept_until: '2026-09-12T23:59:00.000Z',
      applied_at: '2026-09-08T12:00:00.000Z'
    }
  }),
  sendPassPortExtension: vi.fn().mockResolvedValue(undefined),
  sendPassPortRollback: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@@/server/utils/db', () => ({
  default: {
    passRedemption: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    },
    studentPassPool: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    assignmentOverrideStudent: {
      findFirst: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    },
    assignmentOverride: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma)
    })
  }
}))

describe('PassPort Pass Redemption Hook & Fail-Safe Handling', () => {
  const futureDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const mockPool = {
    id: 'pool-1',
    balance: 5,
    passType: {
      id: 'pt-1',
      name: 'Late Pass',
      hoursPerPass: 24,
      extensionOnly: true,
      courseId: 'course-1',
      course: { name: 'CS 2114', label: 'CS 2114' }
    },
    user: {
      id: 'user-1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'ghopper@vt.edu',
      ltiIdentities: [{ platformId: 'platform-1', ltiSub: 'sub-hopper', platformUserId: '9988' }]
    }
  }

  const baseAssignment = {
    id: 'asg-1',
    title: 'Project 1',
    dueDate: futureDueDate,
    acceptUntil: futureDueDate,
    resourceLinkId: 'res-link-1',
    canvasAssignmentId: 'canvas-asg-1',
    courseId: 'course-1',
    course: {
      id: 'course-1',
      label: 'CS 2114',
      title: 'Data Structures',
      ltiContextId: 'course-ctx-1',
      canvasCourseId: 'canvas-course-1',
      deployment: {
        deploymentId: 'deploy-1',
        deploymentHost: 'canvas.vt.edu',
        platformId: 'platform-1',
        platform: { id: 'platform-1', issuer: 'https://canvas.vt.edu', name: 'VT Canvas' }
      }
    },
    passEligibilities: [{ passTypeId: 'pt-1' }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redeems normally without dispatching PassPort when tool does not support PassPort', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...baseAssignment,
      tool: {
        id: 'tool-proxy-only',
        supportsPassport: false
      }
    } as any)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.passRedemption.create).mockResolvedValue({
      id: 'redemption-1',
      cost: 1
    } as any)
    vi.mocked(prisma.studentPassPool.update).mockResolvedValue({ ...mockPool, balance: 4 } as any)

    const result = await redeemPass('user-1', 'asg-1', 'pt-1')

    expect(result.id).toBe('redemption-1')
    expect(sendPassPortExtension).not.toHaveBeenCalled()
    expect(prisma.studentPassPool.update).toHaveBeenCalledWith({
      where: { id: 'pool-1' },
      data: { balance: { decrement: 1 } }
    })
    expect(notifyPassRedemption).toHaveBeenCalled()
  })

  it('dispatches PassPort extension webhook when tool supports PassPort and is REGISTERED', async () => {
    const registeredTool = {
      id: 'tool-passport-1',
      name: 'Web-CAT',
      supportsPassport: true,
      passportRegistrationStatus: 'REGISTERED',
      passportExtensionUrl: 'https://web-cat.org/api/passport/v1/extensions',
      passportClientId: 'cid-webcat',
      passportClientSecret: 'sec-webcat',
      passportRequestedProperties: ['canvas_course_id', 'email', 'first_name']
    }

    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...baseAssignment,
      tool: registeredTool
    } as any)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      role: 'StudentEnrollment'
    } as any)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.passRedemption.create).mockResolvedValue({
      id: 'redemption-2',
      cost: 1
    } as any)
    vi.mocked(prisma.studentPassPool.update).mockResolvedValue({ ...mockPool, balance: 4 } as any)

    const result = await redeemPass('user-1', 'asg-1', 'pt-1')

    expect(result.id).toBe('redemption-2')
    expect(buildPassPortExtensionPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        extension: expect.objectContaining({
          passType: 'Late Pass',
          originalDueDate: futureDueDate,
          newDueDate: null,
          originalAcceptUntil: futureDueDate,
          newAcceptUntil: expect.any(Date)
        })
      })
    )
    expect(sendPassPortExtension).toHaveBeenCalledWith(
      registeredTool,
      expect.objectContaining({
        request_id: 'mock-req-uuid-1234'
      })
    )
    expect(prisma.passRedemption.create).toHaveBeenCalled()
    expect(prisma.studentPassPool.update).toHaveBeenCalledWith({
      where: { id: 'pool-1' },
      data: { balance: { decrement: 1 } }
    })
    expect(sendPassPortRollback).not.toHaveBeenCalled()
  })

  it('fails fast if tool supports PassPort but is not REGISTERED or credentials are missing', async () => {
    const unreadyTool = {
      id: 'tool-unready',
      name: 'PrairieLearn',
      supportsPassport: true,
      passportRegistrationStatus: 'FAILED',
      passportExtensionUrl: null,
      passportClientSecret: null
    }

    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...baseAssignment,
      tool: unreadyTool
    } as any)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)

    await expect(redeemPass('user-1', 'asg-1', 'pt-1')).rejects.toThrow(
      'External tool is not registered for PassPort extensions. Please contact your instructor.'
    )

    expect(notifyPassPortSyncFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'PrairieLearn',
        assignmentTitle: 'Project 1'
      })
    )
    expect(sendPassPortExtension).not.toHaveBeenCalled()
    expect(prisma.studentPassPool.update).not.toHaveBeenCalled()
  })

  it('aborts redemption, sends admin alert, and preserves pass balance if tool extension dispatch throws', async () => {
    const registeredTool = {
      id: 'tool-passport-1',
      name: 'Web-CAT',
      supportsPassport: true,
      passportRegistrationStatus: 'REGISTERED',
      passportExtensionUrl: 'https://web-cat.org/api/passport/v1/extensions',
      passportClientId: 'cid-webcat',
      passportClientSecret: 'sec-webcat'
    }

    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...baseAssignment,
      tool: registeredTool
    } as any)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)

    vi.mocked(sendPassPortExtension).mockRejectedValueOnce(
      new Error('504 Gateway Timeout connecting to Web-CAT')
    )

    await expect(redeemPass('user-1', 'asg-1', 'pt-1')).rejects.toThrow(
      'External tool extension sync failed. Please contact your instructor for assistance.'
    )

    expect(notifyPassPortSyncFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Web-CAT',
        error: '504 Gateway Timeout connecting to Web-CAT',
        requestId: 'mock-req-uuid-1234'
      })
    )
    expect(prisma.passRedemption.create).not.toHaveBeenCalled()
    expect(prisma.studentPassPool.update).not.toHaveBeenCalled()
  })

  it('dispatches rollback DELETE request if a downstream failure occurs after tool extension dispatch succeeds', async () => {
    const registeredTool = {
      id: 'tool-passport-1',
      name: 'Web-CAT',
      supportsPassport: true,
      passportRegistrationStatus: 'REGISTERED',
      passportExtensionUrl: 'https://web-cat.org/api/passport/v1/extensions',
      passportClientId: 'cid-webcat',
      passportClientSecret: 'sec-webcat'
    }

    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...baseAssignment,
      tool: registeredTool
    } as any)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
    vi.mocked(sendPassPortExtension).mockResolvedValueOnce(undefined)

    // Downstream database failure during passRedemption.create
    vi.mocked(prisma.passRedemption.create).mockRejectedValueOnce(
      new Error('Database deadlock on PassRedemption')
    )

    await expect(redeemPass('user-1', 'asg-1', 'pt-1')).rejects.toThrow(
      'Database deadlock on PassRedemption'
    )

    expect(sendPassPortExtension).toHaveBeenCalled()
    expect(sendPassPortRollback).toHaveBeenCalledWith(registeredTool, 'mock-req-uuid-1234')
  })
})
