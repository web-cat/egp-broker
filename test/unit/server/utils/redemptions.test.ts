import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStudentPoolRedemptions, getStudentRedemptionsFull } from '../../../../server/utils/redemptions'
import prisma from '../../../../lib/prisma'

vi.mock('../../../../lib/prisma', () => ({
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

    describe('getStudentPoolRedemptions', () => {
        it('should return mapped redemption rows', async () => {
            const mockDate = new Date('2023-01-01T00:00:00.000Z')
            const mockRedemptions = [
                {
                    id: 'r1',
                    assignment: { title: 'A1' },
                    createdAt: mockDate,
                    cost: 1,
                    availableFrom: null,
                    acceptUntil: null,
                    // Missing pool/passType info in simple fetch, manually mapped 0
                }
            ]

            vi.mocked(prisma.passRedemption.findMany).mockResolvedValue(mockRedemptions as any)

            const result = await getStudentPoolRedemptions('pool1')

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                id: 'r1',
                assignmentTitle: 'A1',
                createdAt: mockDate.toISOString(),
                cost: 1,
                hoursPerPass: 0,
                availableFrom: null,
                acceptUntil: null,
                isActive: true
            })
        })
    })

    describe('getStudentRedemptionsFull', () => {
        it('should return mapped redemption rows with hoursPerPass', async () => {
            const mockDate = new Date('2023-01-01T00:00:00.000Z')
            const mockRedemptions = [
                {
                    id: 'r1',
                    assignment: { title: 'A1' },
                    createdAt: mockDate,
                    cost: 1,
                    availableFrom: null,
                    acceptUntil: null,
                    pool: {
                        passType: { hoursPerPass: 24 }
                    }
                }
            ]

            vi.mocked(prisma.passRedemption.findMany).mockResolvedValue(mockRedemptions as any)

            const result = await getStudentRedemptionsFull('pool1')

            expect(prisma.passRedemption.findMany).toHaveBeenCalledWith(expect.objectContaining({
                include: expect.objectContaining({
                    pool: { include: { passType: { select: { hoursPerPass: true } } } }
                })
            }))

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({
                id: 'r1',
                assignmentTitle: 'A1',
                createdAt: mockDate.toISOString(),
                cost: 1,
                hoursPerPass: 24,
                availableFrom: null,
                acceptUntil: null,
                isActive: true
            })
        })
    })
})
