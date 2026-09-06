import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import credentialsPost from '@@/server/api/passport/v1/credentials.post'
import { handlePassPortCredentialsDelivery } from '@@/server/utils/passport'

vi.mock('@@/server/utils/passport', () => ({
  handlePassPortCredentialsDelivery: vi.fn()
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getQuery: vi.fn((event) => event.query || {}),
    readBody: vi.fn((event) => Promise.resolve(event.body || {})),
    createError: (opts: any) => opts
  }
})

const mockWebhookEvent = (query = {}, body = {}) =>
  ({
    query,
    body
  }) as unknown as H3Event

describe('API: POST /api/passport/v1/credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to handlePassPortCredentialsDelivery with query token and body', async () => {
    const payload = {
      tool_name: 'CodeWorkout',
      passport_version: '1.0',
      endpoints: {
        extension_handler: 'https://codeworkout.org/api/passport/v1/extension'
      },
      credentials: {
        client_id: 'cid',
        client_secret: 'sec'
      }
    }
    const event = mockWebhookEvent({ token: 'test-token-123' }, payload)
    const mockToolRow = {
      id: 'tool-1',
      passportRegistrationStatus: 'REGISTERED'
    }

    vi.mocked(handlePassPortCredentialsDelivery).mockResolvedValue(mockToolRow as any)

    const result = await credentialsPost(event)

    expect(handlePassPortCredentialsDelivery).toHaveBeenCalledWith('test-token-123', payload)
    expect(result).toEqual({
      statusCode: 200,
      data: mockToolRow
    })
  })
})
