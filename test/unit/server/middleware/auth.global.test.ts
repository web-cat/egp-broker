import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { ERROR_CODES } from '@@/shared/constants/errors'

const mockRequireUserSession = vi.fn()
const mockUnauthorizedError = vi.fn((code: string, message: string) => {
  const err = new Error(message)
  ;(err as any).statusCode = 401
  ;(err as any).code = code
  return err
})

vi.stubGlobal('defineEventHandler', (fn: any) => fn)
vi.stubGlobal('requireUserSession', mockRequireUserSession)
vi.stubGlobal('unauthorizedError', mockUnauthorizedError)
vi.stubGlobal('ERROR_CODES', ERROR_CODES)

const createMockEvent = (path: string, method = 'GET'): H3Event => {
  return {
    path,
    method,
    context: {}
  } as unknown as H3Event
}

describe('Server Middleware: auth.global', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips non-API routes', async () => {
    const { default: authMiddleware } = await import('@@/server/middleware/auth.global')
    const event = createMockEvent('/dashboard', 'GET')

    await authMiddleware(event)

    expect(mockRequireUserSession).not.toHaveBeenCalled()
  })

  it('allows POST /api/passport/v1/credentials without user session', async () => {
    const { default: authMiddleware } = await import('@@/server/middleware/auth.global')
    const event = createMockEvent('/api/passport/v1/credentials?token=123', 'POST')

    await authMiddleware(event)

    expect(mockRequireUserSession).not.toHaveBeenCalled()
  })

  it('requires session for protected routes when session is missing', async () => {
    const { default: authMiddleware } = await import('@@/server/middleware/auth.global')
    const event = createMockEvent('/api/admin/tools', 'GET')
    mockRequireUserSession.mockRejectedValue(new Error('No session'))

    await expect(authMiddleware(event)).rejects.toThrow('Authentication required')
    expect(mockRequireUserSession).toHaveBeenCalledWith(event)
  })

  it('attaches user to context when session is present on protected route', async () => {
    const { default: authMiddleware } = await import('@@/server/middleware/auth.global')
    const event = createMockEvent('/api/admin/tools', 'GET')
    const mockUser = { id: 'u1', email: 'test@example.com', role: 'ADMIN' }
    mockRequireUserSession.mockResolvedValue({ user: mockUser })

    await authMiddleware(event)

    expect(event.context.user).toEqual(mockUser)
    expect(event.context.ability).toBeDefined()
  })
})
