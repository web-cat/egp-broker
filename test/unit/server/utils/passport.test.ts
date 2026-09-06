import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  initiatePassPortRegistration,
  handlePassPortCredentialsDelivery
} from '../../../../server/utils/passport'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiTool: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/site', () => ({
  getServerSiteUrl: vi.fn(() => 'https://broker.university.edu')
}))

const mockFetch = vi.fn()
;(globalThis as any).$fetch = mockFetch

describe('PassPort Server Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initiatePassPortRegistration', () => {
    const mockEvent = {} as any

    it('throws 404 if tool does not exist', async () => {
      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(null)

      await expect(initiatePassPortRegistration('missing-id', mockEvent)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('throws 400 if tool is missing passportRegistrationUrl', async () => {
      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue({
        id: 't1',
        name: 'Tool 1',
        passportRegistrationUrl: null
      } as any)

      await expect(initiatePassPortRegistration('t1', mockEvent)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('successfully initiates registration, updates DB to PENDING, and dispatches Phase 1 POST', async () => {
      const mockTool = {
        id: 't1',
        name: 'CodeWorkout',
        baseUrl: 'https://codeworkout.org',
        protocol: 'LTI13',
        key: 'k',
        supportsProxy: true,
        supportsPassport: true,
        supportsExtensionApi: false,
        passportClientId: null,
        passportRegistrationUrl: 'https://codeworkout.org/api/passport/v1/register',
        passportExtensionUrl: null,
        passportRegistrationStatus: 'NOT_REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: null,
        passportRequestedProperties: null,
        platformId: null,
        platform: null,
        createdAt: new Date('2026-09-06T00:00:00.000Z')
      }

      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(mockTool as any)
      vi.mocked(prisma.ltiTool.update).mockResolvedValue({
        ...mockTool,
        passportRegistrationStatus: 'PENDING',
        passportRegistrationToken: 'test-token-123'
      } as any)
      mockFetch.mockResolvedValue({ status: 202 })

      const result = await initiatePassPortRegistration('t1', mockEvent)

      expect(prisma.ltiTool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({
            supportsPassport: true,
            passportRegistrationStatus: 'PENDING',
            passportRegistrationToken: expect.any(String),
            passportRegistrationError: null
          })
        })
      )

      expect(mockFetch).toHaveBeenCalledWith(
        'https://codeworkout.org/api/passport/v1/register',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            broker_base_url: 'https://broker.university.edu',
            callback_url: expect.stringContaining(
              'https://broker.university.edu/api/passport/v1/credentials?token='
            ),
            name: 'EGP Broker',
            passport_version: '1.0'
          })
        })
      )

      expect(result.passportRegistrationStatus).toBe('PENDING')
    })

    it('updates status to FAILED and throws 502 when external tool POST fails', async () => {
      const mockTool = {
        id: 't1',
        name: 'CodeWorkout',
        passportRegistrationUrl: 'https://codeworkout.org/api/passport/v1/register',
        createdAt: new Date()
      }

      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(mockTool as any)
      vi.mocked(prisma.ltiTool.update).mockResolvedValue({
        ...mockTool,
        passportRegistrationStatus: 'PENDING',
        passportRegistrationToken: 'token-abc'
      } as any)
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      await expect(initiatePassPortRegistration('t1', mockEvent)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 502 })
      )

      expect(prisma.ltiTool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({
            passportRegistrationStatus: 'FAILED',
            passportRegistrationError: 'Connection refused'
          })
        })
      )
    })
  })

  describe('handlePassPortCredentialsDelivery', () => {
    const validBody = {
      tool_name: 'CodeWorkout',
      passport_version: '1.0',
      endpoints: {
        extension_handler: 'https://codeworkout.org/api/passport/v1/extension'
      },
      requested_properties: ['email', 'canvas_course_id'],
      credentials: {
        client_id: 'tool-client-001',
        client_secret: 'tool-secret-999'
      }
    }

    it('throws 400 if token is missing or empty', async () => {
      await expect(handlePassPortCredentialsDelivery('', validBody)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
      await expect(handlePassPortCredentialsDelivery(undefined, validBody)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('throws 404 if token does not match any pending tool', async () => {
      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(null)

      await expect(
        handlePassPortCredentialsDelivery('invalid-token', validBody)
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 404 }))
    })

    it('throws 404 if tool is found but status is not PENDING', async () => {
      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue({
        id: 't1',
        passportRegistrationStatus: 'REGISTERED'
      } as any)

      await expect(handlePassPortCredentialsDelivery('old-token', validBody)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('throws error when body fails schema validation', async () => {
      await expect(
        handlePassPortCredentialsDelivery('token-123', { invalid: 'payload' })
      ).rejects.toThrow()
    })

    it('successfully validates credentials, updates DB to REGISTERED, and clears token', async () => {
      const pendingTool = {
        id: 't1',
        name: 'CodeWorkout',
        baseUrl: 'https://codeworkout.org',
        protocol: 'LTI13',
        key: 'k',
        supportsProxy: true,
        supportsPassport: true,
        supportsExtensionApi: false,
        passportRegistrationToken: 'valid-token',
        passportRegistrationStatus: 'PENDING',
        platformId: null,
        platform: null,
        createdAt: new Date('2026-09-06T00:00:00.000Z')
      }

      const updatedRecord = {
        ...pendingTool,
        passportClientId: 'tool-client-001',
        passportClientSecret: 'tool-secret-999',
        passportExtensionUrl: 'https://codeworkout.org/api/passport/v1/extension',
        passportRequestedProperties: ['email', 'canvas_course_id'],
        passportRegistrationStatus: 'REGISTERED',
        passportRegistrationError: null,
        passportRegisteredAt: new Date('2026-09-06T12:00:00.000Z'),
        passportRegistrationToken: null
      }

      vi.mocked(prisma.ltiTool.findUnique).mockResolvedValue(pendingTool as any)
      vi.mocked(prisma.ltiTool.update).mockResolvedValue(updatedRecord as any)

      const result = await handlePassPortCredentialsDelivery('valid-token', validBody)

      expect(prisma.ltiTool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({
            passportClientId: 'tool-client-001',
            passportClientSecret: 'tool-secret-999',
            passportExtensionUrl: 'https://codeworkout.org/api/passport/v1/extension',
            passportRequestedProperties: ['email', 'canvas_course_id'],
            passportRegistrationStatus: 'REGISTERED',
            passportRegistrationToken: null
          })
        })
      )

      expect(result.passportRegistrationStatus).toBe('REGISTERED')
      expect(result.passportClientId).toBe('tool-client-001')
      expect(result.passportExtensionUrl).toBe('https://codeworkout.org/api/passport/v1/extension')
    })
  })
})
