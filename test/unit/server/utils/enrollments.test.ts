import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentEnrollment, getUserEnrollments } from '../../../../server/utils/enrollments'
import prisma from '../../../../lib/prisma'

vi.mock('../../../../lib/prisma', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    course: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('../../../../shared/models/enrollment', async () => {
  const actual = await vi.importActual('../../../../shared/models/enrollment')
  return {
    ...actual,
    toSimpleEnrollment: vi.fn((e) => ({ id: e.id, courseId: e.courseId, role: e.role }))
  }
})

describe('Server Utils: Enrollments', () => {
  const mockEnrollment = {
    id: 'e1',
    userId: 'u1',
    courseId: 'c1',
    role: 'STUDENT',
    course: { title: 'Course 1', label: 'C1' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCurrentEnrollment', () => {
    it('should return enrollment from DB context if valid', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(mockEnrollment as any)

      const result = await getCurrentEnrollment('u1', 'c1')

      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 'u1', courseId: 'c1' } },
        include: { course: true }
      })
      expect(result).toEqual({ id: 'e1', courseId: 'c1', role: 'STUDENT' })
    })

    it('should return null if DB context is invalid', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

      const result = await getCurrentEnrollment('u1', 'c1')

      expect(result).toBeNull()
    })

    it('should return enrollment from LTI context if DB context missing', async () => {
      const ltiSession: any = {
        deploymentId: 'd1',
        context: { id: 'ctx1' }
      }
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 'c1' } as any)
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(mockEnrollment as any)

      const result = await getCurrentEnrollment('u1', null, ltiSession)

      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { deploymentId_ltiContextId: { deploymentId: 'd1', ltiContextId: 'ctx1' } }
      })
      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 'u1', courseId: 'c1' } },
        include: { course: true }
      })
      expect(result).toEqual({ id: 'e1', courseId: 'c1', role: 'STUDENT' })
    })

    it('should return null if LTI context yields no course', async () => {
      const ltiSession: any = {
        deploymentId: 'd1',
        context: { id: 'ctx1' }
      }
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null)

      const result = await getCurrentEnrollment('u1', null, ltiSession)

      expect(prisma.course.findUnique).toHaveBeenCalled()
      expect(prisma.enrollment.findUnique).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('getUserEnrollments', () => {
    it('should return all valid enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([mockEnrollment] as any)

      const result = await getUserEnrollments('u1')

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          course: {
            OR: [
              { workflowState: 'available' },
              { workflowState: 'active' },
              { workflowState: null }
            ]
          }
        },
        include: { course: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 'e1', courseId: 'c1', role: 'STUDENT' })
    })
  })
})
