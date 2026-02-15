import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllTools, getTool } from '../../../../server/utils/lti-tools'
import prisma from '../../../../lib/prisma'

vi.mock('../../../../lib/prisma', () => ({
  default: {
    ltiTool: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('LTI Tool Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllTools', () => {
    it('should return mapped tool rows', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockTools = [
        {
          id: 't1',
          name: 'My Tool',
          baseUrl: 'https://tool.com',
          protocol: 'LTI13',
          key: 'key1',
          supportsExtensionApi: true,
          platformId: 'p1',
          platform: { issuer: 'iss1' },
          createdAt: mockDate
        }
      ]

      vi.mocked(prisma.ltiTool.findMany).mockResolvedValue(mockTools as any)

      const result = await getAllTools()

      expect(result).toEqual([
        {
          id: 't1',
          name: 'My Tool',
          baseUrl: 'https://tool.com',
          protocol: 'LTI13',
          key: 'key1',
          supportsExtensionApi: true,
          platformId: 'p1',
          platformIssuer: 'iss1',
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })

  describe('getTool', () => {
    it('should return mapped tool row', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockTool = {
        id: 't1',
        name: 'My Tool',
        baseUrl: 'https://tool.com',
        protocol: 'LTI13',
        key: 'key1',
        supportsExtensionApi: true,
        platformId: 'p1',
        platform: { issuer: 'iss1' },
        createdAt: mockDate
      }

      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(mockTool as any)

      const result = await getTool('t1')

      expect(result).toEqual({
        id: 't1',
        name: 'My Tool',
        baseUrl: 'https://tool.com',
        protocol: 'LTI13',
        key: 'key1',
        supportsExtensionApi: true,
        platformId: 'p1',
        platformIssuer: 'iss1',
        createdAt: mockDate.toISOString()
      })
    })
  })
})
