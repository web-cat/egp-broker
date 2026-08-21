import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllCourses, getCourse } from '../../../../server/utils/courses'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    course: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('Course Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllCourses', () => {
    it('should return mapped course rows', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockCourses = [
        {
          id: 'c1',
          ltiContextId: 'lti1',
          label: 'L1',
          title: 'T1',
          canvasCourseId: '12345',
          workflowState: 'available',
          createdAt: mockDate,
          _count: { enrollments: 10, assignments: 5 }
        }
      ]

      vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses as any)

      const result = await getAllCourses()

      expect(result).toEqual([
        {
          id: 'c1',
          ltiContextId: 'lti1',
          label: 'L1',
          title: 'T1',
          canvasCourseId: '12345',
          workflowState: 'available',
          enrollmentCount: 10,
          assignmentCount: 5,
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })

  describe('getCourse', () => {
    it('should return null if not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null)
      const result = await getCourse('missing')
      expect(result).toBeNull()
    })

    it('should return mapped course row', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockCourse = {
        id: 'c1',
        ltiContextId: 'lti1',
        label: 'L1',
        title: 'T1',
        canvasCourseId: '12345',
        workflowState: 'available',
        createdAt: mockDate,
        _count: { enrollments: 10, assignments: 5 }
      }

      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any)

      const result = await getCourse('c1')

      expect(result).toEqual({
        id: 'c1',
        ltiContextId: 'lti1',
        label: 'L1',
        title: 'T1',
        canvasCourseId: '12345',
        workflowState: 'available',
        enrollmentCount: 10,
        assignmentCount: 5,
        createdAt: mockDate.toISOString()
      })
    })
  })
})
