import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redeemPass } from '../../../../server/utils/redemptions'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/services/alert.service', () => ({
  notifyPassRedemption: vi.fn().mockResolvedValue(true),
  notifyPassPortSyncFailure: vi.fn().mockResolvedValue(true)
}))

vi.mock('@@/server/utils/db', () => {
  const mockPrisma: any = {
    passRedemption: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'red-1', cost: 1 })
    },
    studentPassPool: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    passType: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    gtaInterviewReservation: {
      findFirst: vi.fn()
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
    $transaction: vi.fn((callback: any) => callback(mockPrisma))
  }
  return { default: mockPrisma }
})

describe('Utility: redeemPass - GTA Interview Gating', () => {
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.assignmentOverride.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.passRedemption.create).mockResolvedValue({ id: 'red-1', cost: 1 } as any)
    vi.mocked(prisma.studentPassPool.update).mockResolvedValue({} as any)
  })

  it('rejects resubmission pass when assignment requires interview and no completed interview exists', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
      id: 'pool-1',
      userId: 'student-1',
      balance: 3,
      passType: {
        id: 'pass-resubmit',
        name: 'Resubmission Pass',
        courseId: 'course-1',
        hoursPerPass: 24,
        extensionOnly: false
      },
      user: { id: 'student-1', ltiIdentities: [] }
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'assign-1',
      courseId: 'course-1',
      dueDate,
      acceptUntil: dueDate,
      hasInterviews: true,
      passEligibilities: [{ passTypeId: 'pass-resubmit' }],
      tool: null,
      course: null
    } as any)

    // No completed interview
    vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

    await expect(redeemPass('student-1', 'assign-1', 'pass-resubmit')).rejects.toThrowError(
      expect.objectContaining({
        statusCode: 400,
        statusMessage: expect.stringContaining('requires a completed grading interview')
      })
    )

    expect(prisma.gtaInterviewReservation.findFirst).toHaveBeenCalledWith({
      where: {
        assignmentId: 'assign-1',
        studentId: 'student-1',
        status: { in: ['COMPLETED', 'CHECKED_OUT'] }
      }
    })
  })

  it('allows resubmission pass when student has a COMPLETED interview', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
      id: 'pool-1',
      userId: 'student-1',
      balance: 3,
      passType: {
        id: 'pass-resubmit',
        name: 'Resubmission Pass',
        courseId: 'course-1',
        hoursPerPass: 24,
        extensionOnly: false
      },
      user: { id: 'student-1', ltiIdentities: [] }
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'assign-1',
      courseId: 'course-1',
      dueDate,
      acceptUntil: dueDate,
      hasInterviews: true,
      passEligibilities: [{ passTypeId: 'pass-resubmit' }],
      tool: null,
      course: null
    } as any)

    // Completed interview found
    vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
      id: 'interview-1',
      status: 'COMPLETED'
    } as any)

    const result = await redeemPass('student-1', 'assign-1', 'pass-resubmit')
    expect(result).toBeDefined()
    expect(prisma.gtaInterviewReservation.findFirst).toHaveBeenCalled()
  })

  it('allows resubmission pass when student has a CHECKED_OUT interview', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
      id: 'pool-1',
      userId: 'student-1',
      balance: 3,
      passType: {
        id: 'pass-resubmit',
        name: 'Resubmission Pass',
        courseId: 'course-1',
        hoursPerPass: 24,
        extensionOnly: false
      },
      user: { id: 'student-1', ltiIdentities: [] }
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'assign-1',
      courseId: 'course-1',
      dueDate,
      acceptUntil: dueDate,
      hasInterviews: true,
      passEligibilities: [{ passTypeId: 'pass-resubmit' }],
      tool: null,
      course: null
    } as any)

    // Checked-out interview found
    vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
      id: 'interview-1',
      status: 'CHECKED_OUT'
    } as any)

    const result = await redeemPass('student-1', 'assign-1', 'pass-resubmit')
    expect(result).toBeDefined()
    expect(prisma.gtaInterviewReservation.findFirst).toHaveBeenCalled()
  })

  it('allows extensionOnly pass without checking for completed interview', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
      id: 'pool-1',
      userId: 'student-1',
      balance: 3,
      passType: {
        id: 'pass-extension',
        name: 'Late Day Pass',
        courseId: 'course-1',
        hoursPerPass: 24,
        extensionOnly: true // Extension pass
      },
      user: { id: 'student-1', ltiIdentities: [] }
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'assign-1',
      courseId: 'course-1',
      dueDate,
      acceptUntil: dueDate,
      hasInterviews: true,
      passEligibilities: [{ passTypeId: 'pass-extension' }],
      tool: null,
      course: null
    } as any)

    const result = await redeemPass('student-1', 'assign-1', 'pass-extension')
    expect(result).toBeDefined()
    expect(prisma.gtaInterviewReservation.findFirst).not.toHaveBeenCalled()
  })

  it('allows resubmission pass when assignment hasInterviews is false', async () => {
    vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
      id: 'pool-1',
      userId: 'student-1',
      balance: 3,
      passType: {
        id: 'pass-resubmit',
        name: 'Resubmission Pass',
        courseId: 'course-1',
        hoursPerPass: 24,
        extensionOnly: false
      },
      user: { id: 'student-1', ltiIdentities: [] }
    } as any)

    vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
      id: 'assign-1',
      courseId: 'course-1',
      dueDate,
      acceptUntil: dueDate,
      hasInterviews: false, // No interviews required
      passEligibilities: [{ passTypeId: 'pass-resubmit' }],
      tool: null,
      course: null
    } as any)

    const result = await redeemPass('student-1', 'assign-1', 'pass-resubmit')
    expect(result).toBeDefined()
    expect(prisma.gtaInterviewReservation.findFirst).not.toHaveBeenCalled()
  })
})
