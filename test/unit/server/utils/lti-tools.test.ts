import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAllTools, getTool, createTool, updateTool } from '../../../../server/utils/lti-tools'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiTool: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

describe('LTI Tool Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllTools', () => {
    it('should return mapped tool rows including dual-role and passport fields', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockTools = [
        {
          id: 't1',
          name: 'My Tool',
          baseUrl: 'https://tool.com',
          protocol: 'LTI13',
          key: 'key1',
          supportsProxy: true,
          supportsPassport: true,
          supportsExtensionApi: true,
          passportClientId: 'cid-1',
          passportRegistrationUrl: 'https://tool.com/reg',
          passportExtensionUrl: 'https://tool.com/ext',
          passportRegistrationStatus: 'REGISTERED',
          passportRegistrationError: null,
          passportRegisteredAt: mockDate,
          passportRequestedProperties: ['email'],
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
          supportsProxy: true,
          supportsPassport: true,
          supportsExtensionApi: true,
          passportClientId: 'cid-1',
          passportRegistrationUrl: 'https://tool.com/reg',
          passportExtensionUrl: 'https://tool.com/ext',
          passportRegistrationStatus: 'REGISTERED',
          passportRegistrationError: null,
          passportRegisteredAt: mockDate.toISOString(),
          passportRequestedProperties: ['email'],
          platformId: 'p1',
          platformIssuer: 'iss1',
          createdAt: mockDate.toISOString()
        }
      ])
    })
  })

  describe('getTool', () => {
    it('should return mapped tool row with fallback defaults', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const mockTool = {
        id: 't1',
        name: 'My Tool',
        baseUrl: 'https://tool.com',
        protocol: 'LTI13',
        key: 'key1',
        supportsProxy: true,
        supportsPassport: false,
        supportsExtensionApi: false,
        passportClientId: null,
        passportRegistrationUrl: null,
        passportExtensionUrl: null,
        passportRegistrationStatus: 'NOT_REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: null,
        passportRequestedProperties: null,
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
        supportsProxy: true,
        supportsPassport: false,
        supportsExtensionApi: false,
        passportClientId: null,
        passportRegistrationUrl: null,
        passportExtensionUrl: null,
        passportRegistrationStatus: 'NOT_REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: null,
        passportRequestedProperties: null,
        platformId: 'p1',
        platformIssuer: 'iss1',
        createdAt: mockDate.toISOString()
      })
    })
  })

  describe('createTool', () => {
    it('sanitizes empty string URLs to null and persists tool', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const input = {
        name: 'New Tool',
        baseUrl: 'https://tool.com',
        protocol: 'LTI13' as const,
        supportsProxy: true,
        supportsPassport: true,
        passportRegistrationUrl: '',
        passportExtensionUrl: ''
      }

      const createdRecord = {
        id: 'new-id',
        ...input,
        passportRegistrationUrl: null,
        passportExtensionUrl: null,
        supportsExtensionApi: false,
        passportClientId: null,
        passportRegistrationStatus: 'NOT_REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: null,
        passportRequestedProperties: null,
        platformId: null,
        platform: null,
        createdAt: mockDate
      }

      vi.mocked(prisma.ltiTool.create).mockResolvedValue(createdRecord as any)

      const result = await createTool(input as any)

      expect(prisma.ltiTool.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          passportRegistrationUrl: null,
          passportExtensionUrl: null
        }),
        include: { platform: { select: { issuer: true } } }
      })
      expect(result.id).toBe('new-id')
      expect(result.passportRegistrationStatus).toBe('NOT_REGISTERED')
    })
  })

  describe('updateTool', () => {
    it('sanitizes and updates tool record', async () => {
      const mockDate = new Date('2023-01-01T00:00:00.000Z')
      const updateData = {
        supportsPassport: true,
        passportRegistrationStatus: 'PENDING' as const
      }

      const updatedRecord = {
        id: 't1',
        name: 'Updated Tool',
        baseUrl: 'https://tool.com',
        protocol: 'LTI13',
        key: 'k',
        supportsProxy: true,
        supportsPassport: true,
        supportsExtensionApi: false,
        passportClientId: null,
        passportRegistrationUrl: null,
        passportExtensionUrl: null,
        passportRegistrationStatus: 'PENDING',
        passportRegistrationError: null,
        passportRegisteredAt: null,
        passportRequestedProperties: null,
        platformId: null,
        platform: null,
        createdAt: mockDate
      }

      vi.mocked(prisma.ltiTool.update).mockResolvedValue(updatedRecord as any)

      const result = await updateTool('t1', updateData)

      expect(prisma.ltiTool.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: updateData,
        include: { platform: { select: { issuer: true } } }
      })
      expect(result.passportRegistrationStatus).toBe('PENDING')
    })
  })
})
