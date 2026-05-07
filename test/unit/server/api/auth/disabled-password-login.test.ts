import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { H3Event } from 'h3'

// Stub global Nuxt auto-imports for testing
vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {
    enablePasswordLogin: false
  }
}))
vi.stubGlobal('createError', (opts: any) => {
  const error = new Error(opts.message)
  ;(error as any).statusCode = opts.statusCode
  return error
})
vi.stubGlobal('useTranslation', () => Promise.resolve(() => ''))
vi.stubGlobal('validateBody', () => Promise.resolve({}))
vi.stubGlobal('getClientIP', () => '127.0.0.1')
vi.stubGlobal('getCookie', () => 'en')

// Stub the service methods as well so they don't break if execution reaches them
vi.stubGlobal('loginUser', () => Promise.resolve({ user: {} }))
vi.stubGlobal('registerUser', () => Promise.resolve({}))
vi.stubGlobal('requestPasswordReset', () => Promise.resolve({}))
vi.stubGlobal('resetUserPassword', () => Promise.resolve({}))
vi.stubGlobal('createApiResponse', () => ({}))
vi.stubGlobal('createCreatedResponse', () => ({}))

// Mock generic event
const mockEvent = () => ({}) as unknown as H3Event

describe('API: Auth (Password Login Disabled)', () => {
  let endpoints: any[] = []

  beforeAll(async () => {
    endpoints = [
      {
        name: 'POST /api/auth/login',
        handler: (await import('../../../../../server/api/auth/login.post')).default
      },
      {
        name: 'POST /api/auth/register',
        handler: (await import('../../../../../server/api/auth/register.post')).default
      },
      {
        name: 'POST /api/auth/forgot-password',
        handler: (await import('../../../../../server/api/auth/forgot-password.post')).default
      },
      {
        name: 'POST /api/auth/reset-password',
        handler: (await import('../../../../../server/api/auth/reset-password.post')).default
      }
    ]
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 403 Forbidden for POST /api/auth/login', async () => {
    const event = mockEvent()
    try {
      await endpoints[0].handler(event)
      expect.unreachable('Should have thrown a 403 error due to disabled feature')
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toMatch(/disabled/i)
    }
  })

  it('throws 403 Forbidden for POST /api/auth/register', async () => {
    const event = mockEvent()
    try {
      await endpoints[1].handler(event)
      expect.unreachable('Should have thrown a 403 error due to disabled feature')
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toMatch(/disabled/i)
    }
  })

  it('throws 403 Forbidden for POST /api/auth/forgot-password', async () => {
    const event = mockEvent()
    try {
      await endpoints[2].handler(event)
      expect.unreachable('Should have thrown a 403 error due to disabled feature')
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toMatch(/disabled/i)
    }
  })

  it('throws 403 Forbidden for POST /api/auth/reset-password', async () => {
    const event = mockEvent()
    try {
      await endpoints[3].handler(event)
      expect.unreachable('Should have thrown a 403 error due to disabled feature')
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toMatch(/disabled/i)
    }
  })
})
