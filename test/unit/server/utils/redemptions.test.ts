import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStudentRedemptions, redeemPass } from '../../../../server/utils/redemptions'
import prisma from '@@/server/utils/db'

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
    $transaction: vi.fn((callback) => callback(prisma))
  }
}))

describe('Redemption Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStudentRedemptions', () => {
    it('should return mapped redemption rows', async () => {
      const mockRedemptions = [
        {
          id: 'r1',
          assignment: { title: 'A1' },
          createdAt: new Date('2023-01-01'),
          cost: 1,
          availableFrom: null,
          acceptUntil: null,
          pool: {
            passType: { hoursPerPass: 24 }
          }
        }
      ]

      vi.mocked(prisma.passRedemption.findMany).mockResolvedValue(mockRedemptions as any)

      const result = await getStudentRedemptions('u1', 'c1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('r1')
      expect(result[0].assignmentTitle).toBe('A1')
      expect(result[0].hoursPerPass).toBe(24)
    })
  })

  describe('redeemPass', () => {
    it('throws error if pass balance is 0 or pool not found', async () => {
      vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue(null)

      await expect(redeemPass('u1', 'a1', 'pt1')).rejects.toThrow('Insufficient pass balance')
    })

    it('throws error if assignment is not eligible for pass type', async () => {
      vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
        id: 'pool1',
        balance: 3,
        passType: { id: 'pt1', hoursPerPass: 24, extensionOnly: true }
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        passEligibilities: []
      } as any)

      await expect(redeemPass('u1', 'a1', 'pt1')).rejects.toThrow('Assignment is not eligible')
    })

    it('successfully redeems extension pass and deducts cost', async () => {
      const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
        id: 'pool1',
        balance: 3,
        passType: {
          id: 'pt1',
          hoursPerPass: 24,
          extensionOnly: true,
          minDaysPastDue: 0,
          maxDaysPastDue: null
        }
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        dueDate,
        acceptUntil: dueDate,
        passEligibilities: [{ passTypeId: 'pt1' }]
      } as any)

      vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.passRedemption.create).mockResolvedValue({
        id: 'r1',
        cost: 1
      } as any)

      const result = await redeemPass('u1', 'a1', 'pt1')

      expect(result.id).toBe('r1')
      expect(prisma.passRedemption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          poolId: 'pool1',
          assignmentId: 'a1',
          cost: 1
        })
      })
      expect(prisma.studentPassPool.update).toHaveBeenCalledWith({
        where: { id: 'pool1' },
        data: { balance: { decrement: 1 } }
      })
    })

    it('throws error if balance is insufficient for multi-pass catch-up cost', async () => {
      // Due 10 days ago, with 24h passType -> requires 10+ passes
      const oldDueDate = new Date('2020-01-01T00:00:00.000Z')
      vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
        id: 'pool1',
        balance: 1, // Only 1 pass available
        passType: {
          id: 'pt1',
          hoursPerPass: 24,
          extensionOnly: true,
          minDaysPastDue: null,
          maxDaysPastDue: null
        }
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        dueDate: oldDueDate,
        acceptUntil: oldDueDate,
        passEligibilities: [{ passTypeId: 'pt1' }]
      } as any)

      vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)

      await expect(redeemPass('u1', 'a1', 'pt1')).rejects.toThrow(/Insufficient pass balance/)
    })

    it('redeems pass successfully using student override baseline', async () => {
      const baseDueDate = new Date('2020-01-01T00:00:00.000Z') // Base assignment due long ago
      const overrideDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // But student accommodation is tomorrow

      vi.mocked(prisma.studentPassPool.findUnique).mockResolvedValue({
        id: 'pool1',
        balance: 1,
        passType: {
          id: 'pt1',
          hoursPerPass: 24,
          extensionOnly: true,
          courseId: 'c1'
        }
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'a1',
        dueDate: baseDueDate,
        acceptUntil: baseDueDate,
        passEligibilities: [{ passTypeId: 'pt1' }]
      } as any)

      // Student has accommodation override
      vi.mocked(prisma.assignmentOverrideStudent.findFirst).mockResolvedValue({
        override: {
          dueDate: overrideDueDate,
          acceptUntil: overrideDueDate,
          availableFrom: null,
          title: 'SDS Accommodation'
        }
      } as any)

      vi.mocked(prisma.passRedemption.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.passRedemption.create).mockResolvedValue({ id: 'r2', cost: 1 } as any)

      const result = await redeemPass('u1', 'a1', 'pt1')
      expect(result.id).toBe('r2')
      expect(prisma.passRedemption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cost: 1
        })
      })
    })
  })
})
