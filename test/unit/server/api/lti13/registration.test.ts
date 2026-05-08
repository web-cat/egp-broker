import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent } from 'h3'
import handler from '../../../../../server/api/lti13/registration.post'
import prisma from '../../../../../lib/prisma'

// Mock dependencies
vi.mock('../../../../../lib/prisma', () => ({
  default: {
    ltiPlatform: {
      upsert: vi.fn()
    },
    ltiDeployment: {
      upsert: vi.fn()
    }
  }
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    getQuery: vi.fn()
  }
})

describe('LTI 1.3 Dynamic Registration Endpoint', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env.NUXT_SITE_URL = 'https://broker.test'

    // Use vi.stubGlobal for Nuxt/Nitro globals
    vi.stubGlobal('$fetch', vi.fn())
    vi.stubGlobal(
      'useRuntimeConfig',
      vi.fn().mockReturnValue({
        public: { siteUrl: 'https://broker.test' }
      })
    )
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('should successfully register a platform and deployment', async () => {
    const { getQuery } = await import('h3')
    vi.mocked(getQuery).mockReturnValue({
      openid_configuration: 'https://canvas.test/config',
      registration_token: 'secret-token'
    })

    const mockOpenIdConfig = {
      issuer: 'https://canvas.test',
      registration_endpoint: 'https://canvas.test/register',
      authorization_endpoint: 'https://canvas.test/auth',
      token_endpoint: 'https://canvas.test/token',
      jwks_uri: 'https://canvas.test/jwks'
    }

    const mockRegistrationResponse = {
      client_id: 'new-client-id',
      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        deployment_id: 'new-deployment-id'
      }
    }

    // Cast global to any to bypass excessive stack depth checking on complex Nitro types
    const fetchMock = vi.mocked(globalThis.$fetch as any)
    fetchMock
      .mockResolvedValueOnce(mockOpenIdConfig)
      .mockResolvedValueOnce(mockRegistrationResponse)

    vi.mocked(prisma.ltiPlatform.upsert).mockResolvedValue({ id: 'platform-123' } as any)

    // h3 createEvent requires (req, res)
    const req = { url: '/api/lti13/registration', headers: {} }
    const res = { setHeader: vi.fn(), end: vi.fn() }
    const event = createEvent(req as any, res as any)
    const response = await handler(event)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(prisma.ltiPlatform.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issuer: 'https://canvas.test' },
        create: expect.objectContaining({
          clientId: 'new-client-id',
          authEndpoint: 'https://canvas.test/auth'
        })
      })
    )
    expect(prisma.ltiDeployment.upsert).toHaveBeenCalled()
    expect(response).toMatchObject({
      status: 'success',
      clientId: 'new-client-id',
      deploymentId: 'new-deployment-id'
    })
  })

  it('should throw error if platform registration fails', async () => {
    const { getQuery } = await import('h3')
    vi.mocked(getQuery).mockReturnValue({
      openid_configuration: 'https://canvas.test/config',
      registration_token: 'secret-token'
    })

    const fetchMock = vi.mocked(globalThis.$fetch as any)
    fetchMock.mockRejectedValue(new Error('Network error'))

    const req = { url: '/api/lti13/registration', headers: {} }
    const res = { setHeader: vi.fn(), end: vi.fn() }
    const event = createEvent(req as any, res as any)
    await expect(handler(event)).rejects.toThrow('Dynamic registration failed: Network error')
  })
})
