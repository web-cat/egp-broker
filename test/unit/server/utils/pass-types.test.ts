import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCoursePassTypes, getStudentPassPools } from '../../../../server/utils/pass-types'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    passType: {
      findMany: vi.fn()
    },
    studentPassPool: {
      findMany: vi.fn(),
      createMany: vi.fn()
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
          extendsCutoffOnly: false,
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
          extendsCutoffOnly: false,
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

  describe('getStudentPassPools', () => {
    it('returns existing pools when all pass types are provisioned', async () => {
      const mockPassTypes = [{ id: 'pt1', name: 'Pass 1', initialBalance: 3 }]
      const mockPools = [
        {
          id: 'pool-1',
          passTypeId: 'pt1',
          balance: 2,
          passType: { id: 'pt1', name: 'Pass 1', hoursPerPass: 24 }
        }
      ]

      vi.mocked(prisma.passType.findMany).mockResolvedValue(mockPassTypes as any)
      vi.mocked(prisma.studentPassPool.findMany).mockResolvedValue(mockPools as any)

      const result = await getStudentPassPools('u1', 'c1')

      expect(prisma.studentPassPool.createMany).not.toHaveBeenCalled()
      expect(result).toEqual([
        {
          id: 'pool-1',
          name: 'Pass 1',
          balance: 2,
          hoursPerPass: 24,
          passTypeId: 'pt1'
        }
      ])
    })

    it('lazily provisions missing student pass pools with initialBalance', async () => {
      const mockPassTypes = [
        { id: 'pt1', name: 'Pass 1', initialBalance: 3 },
        { id: 'pt2', name: 'Pass 2', initialBalance: 5 }
      ]
      // Student only has pt1 initially
      const existingPools = [
        {
          id: 'pool-1',
          passTypeId: 'pt1',
          balance: 3,
          passType: { id: 'pt1', name: 'Pass 1', hoursPerPass: 24 }
        }
      ]
      const updatedPools = [
        ...existingPools,
        {
          id: 'pool-2',
          passTypeId: 'pt2',
          balance: 5,
          passType: { id: 'pt2', name: 'Pass 2', hoursPerPass: 48 }
        }
      ]

      vi.mocked(prisma.passType.findMany).mockResolvedValue(mockPassTypes as any)
      vi.mocked(prisma.studentPassPool.findMany)
        .mockResolvedValueOnce(existingPools as any)
        .mockResolvedValueOnce(updatedPools as any)

      const result = await getStudentPassPools('u1', 'c1')

      expect(prisma.studentPassPool.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'u1',
            passTypeId: 'pt2',
            balance: 5
          }
        ],
        skipDuplicates: true
      })

      expect(result).toHaveLength(2)
      expect(result).toEqual([
        {
          id: 'pool-1',
          name: 'Pass 1',
          balance: 3,
          hoursPerPass: 24,
          passTypeId: 'pt1'
        },
        {
          id: 'pool-2',
          name: 'Pass 2',
          balance: 5,
          hoursPerPass: 48,
          passTypeId: 'pt2'
        }
      ])
    })
  })
})
