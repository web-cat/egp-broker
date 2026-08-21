import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import platformsGet from '../../../../../server/api/admin/platforms/index.get'
import platformsDelete from '../../../../../server/api/admin/platforms/[id].delete'
import { getAllPlatforms } from '../../../../../server/utils/lti-platforms'
import prisma from '@@/server/utils/db'

// Mock dependencies
vi.mock('../../../../../server/utils/lti-platforms', () => ({
  getAllPlatforms: vi.fn(),
  getPlatform: vi.fn()
}))

vi.mock('@@/server/utils/db', () => ({
  default: {
    ltiPlatform: {
      delete: vi.fn()
    }
  }
}))

// Mock h3 utils
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getValidatedQuery: vi.fn((event, validator) => validator(event.query || {})),
    readValidatedBody: vi.fn((event, validator) => validator(event.body || {})),
    getRouterParam: vi.fn((event, param) => event.context.params?.[param]),
    createError: (opts: any) => {
      const err = new Error(opts.statusMessage || 'Error')
      Object.assign(err, opts)
      return err
    }
  }
})

// Mock generic event
const mockEvent = (userRole: string | null = 'ADMIN', query = {}, body = {}, params = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null,
      params
    },
    query,
    body
  }) as unknown as H3Event

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Admin Platforms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/platforms', () => {
    it('should call getAllPlatforms and return platform data', async () => {
      const event = mockEvent('ADMIN')
      const mockPlatforms = [
        {
          id: 'p1',
          issuer: 'https://canvas.instructure.com',
          clientId: 'client-1',
          name: 'Canvas',
          authEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
          tokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
          jwksEndpoint: 'https://canvas.instructure.com/api/lti/security/jwks',
          deploymentCount: 2,
          createdAt: new Date().toISOString()
        }
      ]
      vi.mocked(getAllPlatforms).mockResolvedValue(mockPlatforms as any)

      const result = await platformsGet(event)

      expect(getAllPlatforms).toHaveBeenCalled()
      expect(result.data).toEqual(mockPlatforms)
    })
  })

  describe('DELETE /api/admin/platforms/:id', () => {
    it('should reject unauthorized users with 403', async () => {
      const event = mockEvent('USER', {}, {}, { id: 'p1' })

      await expect(platformsDelete(event)).rejects.toMatchObject({
        statusCode: 403,
        statusMessage: 'Unauthorized'
      })
      expect(prisma.ltiPlatform.delete).not.toHaveBeenCalled()
    })

    it('should delete platform when called by admin', async () => {
      const event = mockEvent('ADMIN', {}, {}, { id: 'p1' })
      vi.mocked(prisma.ltiPlatform.delete).mockResolvedValue({ id: 'p1' } as any)

      const result = await platformsDelete(event)

      expect(prisma.ltiPlatform.delete).toHaveBeenCalledWith({
        where: { id: 'p1' }
      })
      expect(result).toEqual({ status: 'deleted' })
    })

    it('should throw 500 when deletion fails', async () => {
      const event = mockEvent('ADMIN', {}, {}, { id: 'p1' })
      vi.mocked(prisma.ltiPlatform.delete).mockRejectedValue(new Error('Foreign key violation'))

      await expect(platformsDelete(event)).rejects.toMatchObject({
        statusCode: 500
      })
    })
  })
})
