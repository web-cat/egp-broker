import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import registerPost from '@@/server/api/admin/tools/[id]/passport/register.post'
import { initiatePassPortRegistration } from '@@/server/utils/passport'

vi.mock('@@/server/utils/passport', () => ({
  initiatePassPortRegistration: vi.fn()
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getRouterParam: vi.fn((event, param) => event.context.params?.[param]),
    createError: (opts: any) => opts
  }
})

const mockEvent = (userRole: string | null = 'ADMIN', params = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null,
      params
    }
  }) as unknown as H3Event

vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: POST /api/admin/tools/:id/passport/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 403 when user is not authenticated or not ADMIN', async () => {
    const unauthEvent = mockEvent(null, { id: 'tool-1' })
    await expect(registerPost(unauthEvent)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )

    const userEvent = mockEvent('USER', { id: 'tool-1' })
    await expect(registerPost(userEvent)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('throws 400 when tool ID parameter is missing', async () => {
    const event = mockEvent('ADMIN', {})
    await expect(registerPost(event)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 400 })
    )
  })

  it('invokes initiatePassPortRegistration and returns projected tool', async () => {
    const event = mockEvent('ADMIN', { id: 'tool-1' })
    const mockToolRow = {
      id: 'tool-1',
      name: 'CodeWorkout',
      passportRegistrationStatus: 'PENDING'
    }

    vi.mocked(initiatePassPortRegistration).mockResolvedValue(mockToolRow as any)

    const result = await registerPost(event)

    expect(initiatePassPortRegistration).toHaveBeenCalledWith('tool-1', event)
    expect(result).toEqual({
      statusCode: 200,
      data: mockToolRow
    })
  })
})
