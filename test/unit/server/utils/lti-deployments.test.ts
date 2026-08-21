import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllDeployments } from '../../../../server/utils/lti-deployments'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiDeployment: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('LTI Deployment Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllDeployments', () => {
    it('should return mapped deployment rows', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockDeployments = [
        {
          id: 'd1',
          platformId: 'p1',
          deploymentId: 'dep1',
          deploymentHost: 'canvas',
          platform: { issuer: 'iss1', name: 'Canvas' },
          _count: { courses: 2 },
          createdAt: mockDate
        }
      ]

      vi.mocked(prisma.ltiDeployment.findMany).mockResolvedValue(mockDeployments as any)

      const result = await getAllDeployments()

      expect(result).toEqual([
        {
          id: 'd1',
          platformId: 'p1',
          platformIssuer: 'iss1',
          platformName: 'Canvas',
          deploymentId: 'dep1',
          deploymentHost: 'canvas',
          courseCount: 2,
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })
})
