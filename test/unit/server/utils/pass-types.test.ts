import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCoursePassTypes } from '../../../../server/utils/pass-types'
import prisma from '../../../../lib/prisma'

vi.mock('../../../../lib/prisma', () => ({
  default: {
    passType: {
      findMany: vi.fn()
    }
  }
}))

describe('PassType Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCoursePassTypes', () => {
    it('should return mapped pass type data', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockPassTypes = [
        {
          id: 'pt1',
          name: 'Late Pass',
          description: 'A pass',
          extensionOnly: false,
          initialBalance: 3,
          allowRequests: true,
          hoursPerPass: 24,
          titlePattern: null,
          coolDownPeriod: null,
          coolDownUnit: null,
          coolDownReset: null,
          coolDownResetOffset: null,
          minDaysPastDue: null,
          maxDaysPastDue: null,
          createdAt: mockDate
        }
      ]

      vi.mocked(prisma.passType.findMany).mockResolvedValue(mockPassTypes as any)

      const result = await getCoursePassTypes('c1')

      expect(prisma.passType.findMany).toHaveBeenCalledWith({
        where: { courseId: 'c1' },
        orderBy: { name: 'asc' }
      })

      expect(result).toEqual([
        {
          id: 'pt1',
          name: 'Late Pass',
          description: 'A pass',
          extensionOnly: false,
          initialBalance: 3,
          allowRequests: true,
          hoursPerPass: 24,
          titlePattern: null,
          coolDownPeriod: null,
          coolDownUnit: null,
          coolDownReset: null,
          coolDownResetOffset: null,
          minDaysPastDue: null,
          maxDaysPastDue: null,
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })
})
