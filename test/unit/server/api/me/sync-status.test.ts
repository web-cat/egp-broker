import { describe, it, expect, vi, beforeEach } from 'vitest'
import syncStatusGet from '../../../../../server/api/me/sync-status.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    ltiIdentity: {
      findFirst: vi.fn()
    }
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: /api/me/sync-status GET', () => {
  const mockEvent = (user: any = { id: 'u1', globalRole: 'USER' }) =>
    ({
      context: { user },
      node: { req: { method: 'GET' } }
    }) as any

  // Mocking h3 defineEventHandler
  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      createError: (opts: any) => opts
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when unauthenticated', async () => {
    const event = mockEvent(null)
    await expect(syncStatusGet(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('should return canSync: false when user has no course context or platform', async () => {
    const event = mockEvent()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourse: null
    } as any)

    const result = await syncStatusGet(event)
    expect(result).toEqual({
      statusCode: 200,
      data: { canSync: false, hasCourseContext: false, platformName: null }
    })
  })

  it('should return canSync: false when platform has no API key for user', async () => {
    const event = mockEvent()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourse: {
        deployment: {
          platformId: 'plat1',
          platform: {
            id: 'plat1',
            name: 'Canvas LMS',
            issuer: 'https://canvas.instructure.com'
          }
        }
      }
    } as any)
    vi.mocked(prisma.ltiIdentity.findFirst).mockResolvedValue(null)

    const result = await syncStatusGet(event)
    expect(result).toEqual({
      statusCode: 200,
      data: { canSync: false, hasCourseContext: true, platformName: 'Canvas LMS' }
    })
  })

  it('should return canSync: true when user has an identity with platformApiKey', async () => {
    const event = mockEvent()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourse: {
        deployment: {
          platformId: 'plat1',
          platform: {
            id: 'plat1',
            name: 'Canvas LMS',
            issuer: 'https://canvas.instructure.com'
          }
        }
      }
    } as any)
    vi.mocked(prisma.ltiIdentity.findFirst).mockResolvedValue({
      id: 'ident1',
      platformApiKey: 'test-api-token'
    } as any)

    const result = await syncStatusGet(event)
    expect(result).toEqual({
      statusCode: 200,
      data: { canSync: true, hasCourseContext: true, platformName: 'Canvas LMS' }
    })
  })
})
