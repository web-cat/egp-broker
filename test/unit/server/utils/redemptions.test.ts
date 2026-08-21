import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStudentRedemptions } from '../../../../server/utils/redemptions'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    passRedemption: {
      findMany: vi.fn()
    }
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
})
