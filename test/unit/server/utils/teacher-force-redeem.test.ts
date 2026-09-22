import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  teacherForceRedeemPass,
  syncPassRedemptionCanvasOverride
} from '../../../../server/utils/redemptions'
import prisma from '@@/server/utils/db'
import { notifyPassRedemption } from '@@/server/services/alert.service'
import { sendPassPortExtension } from '@@/server/utils/passport'
import {
  createCanvasAssignmentOverride,
  updateCanvasAssignmentOverride
} from '@@/server/utils/canvas'

vi.mock('@@/server/services/alert.service', () => ({
  notifyPassRedemption: vi.fn().mockResolvedValue(true),
  notifyPassPortSyncFailure: vi.fn().mockResolvedValue(true)
}))

vi.mock('@@/server/utils/passport', () => ({
  buildPassPortExtensionPayload: vi.fn().mockReturnValue({ request_id: 'req-123' }),
  sendPassPortExtension: vi.fn().mockResolvedValue(true),
  sendPassPortRollback: vi.fn().mockResolvedValue(true)
}))

vi.mock('@@/server/utils/canvas', () => ({
  getPlatformCanvasDomain: vi.fn().mockReturnValue('canvas.example.edu'),
  createCanvasAssignmentOverride: vi.fn().mockResolvedValue({ id: 999 }),
  updateCanvasAssignmentOverride: vi.fn().mockResolvedValue({ id: 999 }),
  fetchCanvasAssignmentOverrides: vi.fn().mockResolvedValue([])
}))

vi.mock('@@/server/utils/cbtf-canvas', () => ({
  findInstructorCanvasApiKey: vi.fn().mockResolvedValue('canvas-instructor-key'),
  isPlainCanvasOrNewQuizzes: vi.fn().mockReturnValue(true)
}))

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    passType: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    studentPassPool: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    passRedemption: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn()
    },
    ltiIdentity: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    assignmentOverride: {
      upsert: vi.fn().mockResolvedValue({ id: 'local-ov-1' })
    },
    assignmentOverrideStudent: {
      upsert: vi.fn().mockResolvedValue({})
    },
    user: {
      findUnique: vi.fn()
    }
  }
}))

describe('Teacher Force Redeem Pass', () => {
  const mockCourseId = 'course-1'
  const mockStudentId = 'student-1'
  const mockAssignmentId = 'assign-1'
  const mockPassTypeId = 'pt-1'

  const mockAssignment = {
    id: mockAssignmentId,
    courseId: mockCourseId,
    title: 'Assignment 1',
    canvasAssignmentId: '1001',
    availableFrom: new Date('2026-09-01T00:00:00.000Z'),
    dueDate: new Date('2026-09-10T23:59:59.000Z'),
    acceptUntil: new Date('2026-09-10T23:59:59.000Z'),
    course: {
      id: mockCourseId,
      canvasCourseId: '5001',
      deployment: {
        deploymentHost: 'canvas.example.edu',
        platform: { id: 'platform-1', name: 'Canvas LMS', issuer: 'https://canvas.example.edu' }
      }
    },
    tool: null,
    passEligibilities: [{ passTypeId: mockPassTypeId }]
  }

  const mockPassType = {
    id: mockPassTypeId,
    courseId: mockCourseId,
    name: 'Late Pass',
    hoursPerPass: 24,
    initialBalance: 3,
    extensionOnly: false,
    extendsCutoffOnly: false
  }

  const mockStudent = {
    id: mockStudentId,
    email: 'student@example.edu',
    firstName: 'Alice',
    lastName: 'Smith',
    ltiIdentities: [
      {
        platformId: 'platform-1',
        platformUserId: '42'
      }
    ]
  }

  const mockPool = {
    id: 'pool-1',
    userId: mockStudentId,
    passTypeId: mockPassTypeId,
    balance: 3,
    passType: mockPassType,
    user: mockStudent
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default enrollment found
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'enr-1',
      userId: mockStudentId,
      courseId: mockCourseId,
      role: 'STUDENT',
      courseSectionId: null
    } as any)

    // Default assignment found
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)

    // Default pass type found
    vi.mocked(prisma.passType.findUnique).mockResolvedValue(mockPassType as any)
    vi.mocked(prisma.passType.findMany).mockResolvedValue([mockPassType] as any)

    // Default pool found
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(mockPool as any)
    vi.mocked(prisma.studentPassPool.update).mockResolvedValue({
      ...mockPool,
      balance: 2
    } as any)
    vi.mocked(prisma.studentPassPool.findMany).mockResolvedValue([
      { ...mockPool, balance: 2 }
    ] as any)

    // Default redemption create
    vi.mocked(prisma.passRedemption.create).mockResolvedValue({
      id: 'red-1',
      poolId: mockPool.id,
      assignmentId: mockAssignmentId,
      cost: 1,
      availableFrom: new Date('2026-09-22T12:00:00.000Z'),
      dueDate: new Date('2026-09-23T12:00:00.000Z'),
      acceptUntil: new Date('2026-09-23T12:00:00.000Z'),
      canvasOverrideId: null,
      createdAt: new Date('2026-09-22T12:00:00.000Z'),
      updatedAt: new Date('2026-09-22T12:00:00.000Z'),
      promptResponsesJson: null
    } as any)

    vi.mocked(prisma.passRedemption.findUnique).mockResolvedValue({
      id: 'red-1',
      poolId: mockPool.id,
      assignmentId: mockAssignmentId,
      cost: 1,
      availableFrom: new Date('2026-09-22T12:00:00.000Z'),
      dueDate: new Date('2026-09-23T12:00:00.000Z'),
      acceptUntil: new Date('2026-09-23T12:00:00.000Z'),
      canvasOverrideId: null,
      pool: mockPool,
      assignment: mockAssignment
    } as any)
  })

  it('deducts from pass balance and sets cost to 1 when deductFromBalance is true', async () => {
    const result = await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: true
    })

    expect(prisma.studentPassPool.update).toHaveBeenCalledWith({
      where: { id: mockPool.id },
      data: { balance: 2 }
    })
    expect(prisma.passRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cost: 1,
          poolId: mockPool.id,
          assignmentId: mockAssignmentId
        })
      })
    )
    expect(result.passBalances).toBeDefined()
    expect(notifyPassRedemption).toHaveBeenCalled()
  })

  it('does NOT deduct from pass balance and sets cost to 0 when deductFromBalance is false', async () => {
    vi.mocked(prisma.studentPassPool.findMany).mockResolvedValue([
      { ...mockPool, balance: 3 }
    ] as any)

    const result = await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: false
    })

    expect(prisma.studentPassPool.update).not.toHaveBeenCalled()
    expect(prisma.passRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cost: 0,
          poolId: mockPool.id,
          assignmentId: mockAssignmentId
        })
      })
    )
    expect(result.passBalances[0].balance).toBe(3)
  })

  it('lazily provisions student pass pool if one does not exist yet', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockStudent as any)
    vi.mocked(prisma.studentPassPool.create).mockResolvedValue(mockPool as any)

    await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: true
    })

    expect(prisma.studentPassPool.create).toHaveBeenCalledWith({
      data: {
        userId: mockStudentId,
        passTypeId: mockPassTypeId,
        balance: mockPassType.initialBalance
      },
      include: expect.any(Object)
    })
  })

  it('uses explicitly provided start and end dates', async () => {
    const customStart = '2026-09-25T10:00:00.000Z'
    const customDue = '2026-09-27T10:00:00.000Z'
    const customAccept = '2026-09-28T10:00:00.000Z'

    await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: true,
      availableFrom: customStart,
      dueDate: customDue,
      acceptUntil: customAccept
    })

    expect(prisma.passRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableFrom: new Date(customStart),
          dueDate: new Date(customDue),
          acceptUntil: new Date(customAccept)
        })
      })
    )
  })

  it('dispatches PassPort extension when assignment tool supports PassPort', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      tool: {
        id: 'tool-passport',
        name: 'PassPort Tool',
        supportsPassport: true,
        passportRegistrationStatus: 'REGISTERED',
        passportExtensionUrl: 'https://passport.tool/extend',
        passportClientSecret: 'secret',
        passportRequestedProperties: null,
        platformId: 'platform-1',
        platform: { id: 'platform-1', issuer: 'https://canvas.example.edu' }
      }
    } as any)

    await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: true
    })

    expect(sendPassPortExtension).toHaveBeenCalled()
  })

  it('syncs override to Canvas and saves canvasOverrideId on the redemption', async () => {
    await teacherForceRedeemPass({
      userId: mockStudentId,
      courseId: mockCourseId,
      assignmentId: mockAssignmentId,
      passTypeId: mockPassTypeId,
      deductFromBalance: true
    })

    expect(createCanvasAssignmentOverride).toHaveBeenCalledWith(
      'canvas.example.edu',
      '5001',
      '1001',
      expect.objectContaining({
        student_ids: [42],
        title: '[EGP Pass] Late Pass'
      }),
      'canvas-instructor-key'
    )
    expect(prisma.passRedemption.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'red-1' },
        data: { canvasOverrideId: '999' }
      })
    )
  })

  it('updates existing Canvas override when student already has one for the assignment', async () => {
    vi.mocked(prisma.passRedemption.findUnique).mockResolvedValue({
      id: 'red-2',
      canvasOverrideId: '888',
      pool: mockPool,
      assignment: mockAssignment,
      availableFrom: new Date('2026-09-22T12:00:00.000Z'),
      dueDate: new Date('2026-09-23T12:00:00.000Z'),
      acceptUntil: new Date('2026-09-23T12:00:00.000Z')
    } as any)

    const res = await syncPassRedemptionCanvasOverride('red-2')
    expect(updateCanvasAssignmentOverride).toHaveBeenCalledWith(
      'canvas.example.edu',
      '5001',
      '1001',
      '888',
      expect.any(Object),
      'canvas-instructor-key'
    )
    expect(res.status).toBe('updated')
  })

  it('throws 404 when student is not enrolled in the course', async () => {
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

    await expect(
      teacherForceRedeemPass({
        userId: mockStudentId,
        courseId: mockCourseId,
        assignmentId: mockAssignmentId,
        passTypeId: mockPassTypeId,
        deductFromBalance: true
      })
    ).rejects.toThrow('Student is not enrolled in this course')
  })

  it('throws 400 when assignment does not belong to course or pass type is not eligible', async () => {
    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      ...mockAssignment,
      passEligibilities: [] // not eligible
    } as any)

    await expect(
      teacherForceRedeemPass({
        userId: mockStudentId,
        courseId: mockCourseId,
        assignmentId: mockAssignmentId,
        passTypeId: mockPassTypeId,
        deductFromBalance: true
      })
    ).rejects.toThrow('Assignment is not eligible for this pass type')
  })
})
