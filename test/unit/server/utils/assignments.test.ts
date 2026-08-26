import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  syncAssignmentEligibility,
  syncPassTypeEligibility,
  recalculateAssignmentEligibleDates,
  getCourseAssignments
} from '../../../../server/utils/assignments'
import prisma from '@@/server/utils/db'

// Mock Prisma
vi.mock('@@/server/utils/db', () => ({
  default: {
    assignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    passType: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    passEligibility: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn((ops) => Promise.resolve(ops))
  }
}))

describe('Assignment Eligibility Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recalculateAssignmentEligibleDates', () => {
    it('should calculate correct dates from pass types', async () => {
      const dueDate = new Date('2023-01-10T00:00:00Z')
      const mockAssignment = {
        id: 'assign1',
        dueDate: dueDate,
        passEligibilities: [
          {
            passType: { minDaysPastDue: 2, maxDaysPastDue: 5 }
          },
          {
            passType: { minDaysPastDue: 0, maxDaysPastDue: 3 }
          }
        ]
      }

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)

      await recalculateAssignmentEligibleDates('assign1')

      const expectedFrom = new Date(dueDate.getTime() + 0 * 24 * 60 * 60 * 1000) // min(2, 0) = 0
      const expectedUntil = new Date(dueDate.getTime() + 5 * 24 * 60 * 60 * 1000) // max(5, 3) = 5

      expect(prisma.assignment.update).toHaveBeenCalledWith({
        where: { id: 'assign1' },
        data: {
          eligibleFrom: expectedFrom,
          eligibleUntil: expectedUntil
        }
      })
    })

    it('should handle infinite maxDaysPastDue', async () => {
      const dueDate = new Date('2023-01-10T00:00:00Z')
      const mockAssignment = {
        id: 'assign1',
        dueDate: dueDate,
        passEligibilities: [
          { passType: { minDaysPastDue: 2, maxDaysPastDue: 5 } },
          { passType: { minDaysPastDue: 2, maxDaysPastDue: null } } // Infinite
        ]
      }

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)

      await recalculateAssignmentEligibleDates('assign1')

      // If one is infinite (null), result eligibleUntil should be null
      expect(prisma.assignment.update).toHaveBeenCalledWith({
        where: { id: 'assign1' },
        data: {
          eligibleFrom: expect.any(Date),
          eligibleUntil: null
        }
      })
    })

    it('should reset dates if no eligibilities', async () => {
      const mockAssignment = {
        id: 'assign1',
        dueDate: new Date(),
        passEligibilities: []
      }

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any)

      await recalculateAssignmentEligibleDates('assign1')

      expect(prisma.assignment.update).toHaveBeenCalledWith({
        where: { id: 'assign1' },
        data: {
          eligibleFrom: null,
          eligibleUntil: null
        }
      })
    })
  })

  describe('syncAssignmentEligibility', () => {
    it('should create automatic eligibility and recalculate dates when match found', async () => {
      const assignment = { id: 'a1', title: 'Quiz 1', courseId: 'c1' }
      const passTypes = [{ id: 'pt1', titlePattern: '^Quiz.*' }]
      const existing: any[] = []

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(assignment as any)
      vi.mocked(prisma.passType.findMany).mockResolvedValue(passTypes as any)
      vi.mocked(prisma.passEligibility.findMany).mockResolvedValue(existing)

      // Mock transaction for create
      vi.mocked(prisma.passEligibility.create).mockResolvedValue({} as any)

      // Mock recalculate needing to fetch assignment again
      // We need to ensure the findUnique call inside recalculate returns something useful
      // Or we assume the separate test covers the logic and just check invocation?
      // Since it calls the same findUnique, we might need to mock implementationOnce sequence or just check flow.
      vi.mocked(prisma.assignment.findUnique)
        .mockResolvedValueOnce(assignment as any) // for sync
        .mockResolvedValueOnce({ ...assignment, dueDate: new Date(), passEligibilities: [] } as any) // for recalculate

      await syncAssignmentEligibility('a1')

      expect(prisma.passEligibility.create).toHaveBeenCalled()
      expect(prisma.$transaction).toHaveBeenCalled()
      // Recalculate calls update
      expect(prisma.assignment.update).toHaveBeenCalled()
    })

    it('should delete automatic eligibility when no longer matching', async () => {
      const assignment = { id: 'a1', title: 'Start', courseId: 'c1' }
      const passTypes = [{ id: 'pt1', titlePattern: '^Quiz.*' }] // No match
      const existing = [{ id: 'pe1', passTypeId: 'pt1', isAutomatic: true }]

      vi.mocked(prisma.assignment.findUnique)
        .mockResolvedValueOnce(assignment as any)
        .mockResolvedValueOnce({ ...assignment, dueDate: new Date(), passEligibilities: [] } as any)

      vi.mocked(prisma.passType.findMany).mockResolvedValue(passTypes as any)
      vi.mocked(prisma.passEligibility.findMany).mockResolvedValue(existing as any)
      vi.mocked(prisma.passEligibility.delete).mockResolvedValue({} as any)

      await syncAssignmentEligibility('a1')

      expect(prisma.passEligibility.delete).toHaveBeenCalledWith({ where: { id: 'pe1' } })
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('syncPassTypeEligibility', () => {
    it('should sync all assignments and recalculate', async () => {
      const passType = {
        id: 'pt1',
        titlePattern: 'Quiz',
        course: {
          assignments: [
            { id: 'a1', title: 'Quiz 1' },
            { id: 'a2', title: 'Lab 1' }
          ]
        }
      }

      vi.mocked(prisma.passType.findUnique).mockResolvedValue(passType as any)
      vi.mocked(prisma.passEligibility.findMany).mockResolvedValue([]) // No existing
      vi.mocked(prisma.passEligibility.create).mockResolvedValue({} as any)

      // Mock findUnique for recalculations
      // Called for a1 (match) and possibly a2 (if logic touched it? no match, no existing, so a2 touched? logic says `affectedAssignmentIds` only if op created/deleted)
      // With 'Quiz', a1 matches (create), a2 does not match (no op).
      // So only a1 recalculate.
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        dueDate: new Date(),
        passEligibilities: [{ passType: { minDaysPastDue: 1, maxDaysPastDue: 1 } }]
      } as any)

      await syncPassTypeEligibility('pt1')

      expect(prisma.passEligibility.create).toHaveBeenCalledTimes(1) // Only for a1
      expect(prisma.assignment.update).toHaveBeenCalledTimes(1) // Only for a1
    })
  })

  describe('getCourseAssignments', () => {
    it('should fetch and map modifiers correctly', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockAssignments = [
        {
          id: 'a1',
          resourceLinkId: 'rl1',
          title: 'A1',
          canvasAssignmentId: 'c1',
          dueDate: mockDate,
          availableFrom: mockDate,
          acceptUntil: mockDate,
          published: true,
          createdAt: mockDate,
          course: { label: 'C1', title: 'Course 1' },
          passEligibilities: [{ passType: { name: 'Late Pass' } }]
        }
      ]

      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any)

      const result = await getCourseAssignments('course1')

      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 'course1' }
        })
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'a1',
        resourceLinkId: 'rl1',
        title: 'A1',
        canvasAssignmentId: 'c1',
        courseLabel: 'C1',
        courseTitle: 'Course 1',
        dueDate: mockDate.toISOString(),
        availableFrom: mockDate.toISOString(),
        acceptUntil: mockDate.toISOString(),
        eligibleUntil: null,
        published: true,
        createdAt: mockDate.toISOString(),
        eligiblePassTypeNames: ['Late Pass']
      })
    })
  })
})
