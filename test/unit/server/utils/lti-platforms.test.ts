import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllPlatforms, getPlatform } from '../../../../server/utils/lti-platforms'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiPlatform: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    }
  }
}))

describe('LTI Platform Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllPlatforms', () => {
    it('should return mapped platform rows', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockPlatforms = [
        {
          id: 'p1',
          issuer: 'iss1',
          clientId: 'client1',
          name: 'Canvas',
          authEndpoint: 'https://auth.example.com',
          tokenEndpoint: 'https://token.example.com',
          jwksEndpoint: 'https://jwks.example.com',
          createdAt: mockDate,
          _count: { deployments: 2 }
        }
      ]

      vi.mocked(prisma.ltiPlatform.findMany).mockResolvedValue(mockPlatforms as any)

      const result = await getAllPlatforms()

      expect(result).toEqual([
        {
          id: 'p1',
          issuer: 'iss1',
          clientId: 'client1',
          name: 'Canvas',
          authEndpoint: 'https://auth.example.com',
          tokenEndpoint: 'https://token.example.com',
          jwksEndpoint: 'https://jwks.example.com',
          deploymentCount: 2,
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })

  describe('getPlatform', () => {
    it('should return mapped platform row', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockPlatform = {
        id: 'p1',
        issuer: 'iss1',
        clientId: 'client1',
        name: 'Canvas',
        authEndpoint: 'https://auth.example.com',
        tokenEndpoint: 'https://token.example.com',
        jwksEndpoint: 'https://jwks.example.com',
        createdAt: mockDate,
        _count: { deployments: 2 }
      }

      vi.mocked(prisma.ltiPlatform.findUnique).mockResolvedValue(mockPlatform as any)

      const result = await getPlatform('p1')

      expect(result).toEqual({
        id: 'p1',
        issuer: 'iss1',
        clientId: 'client1',
        name: 'Canvas',
        authEndpoint: 'https://auth.example.com',
        tokenEndpoint: 'https://token.example.com',
        jwksEndpoint: 'https://jwks.example.com',
        deploymentCount: 2,
        createdAt: mockDate.toISOString()
      })
    })
  })
})
