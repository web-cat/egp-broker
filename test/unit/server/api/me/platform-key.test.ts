import { describe, it, expect, vi, beforeEach } from 'vitest'
import platformKeyPost from '../../../../../server/api/me/platform-key.post'
import prisma from '../../../../../lib/prisma'

vi.mock('../../../../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    },
    ltiIdentity: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: /api/me/platform-key POST', () => {
  const mockEvent = (user: any = { id: 'u1', globalRole: 'USER' }, body: any = {}) =>
    ({
      context: { user },
      node: { req: { method: 'POST' } },
      _body: body
    }) as any

  // Mocking h3 defineEventHandler & readValidatedBody
  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readValidatedBody: async (event: any, validator: any) => {
        return validator(event._body)
      },
      createError: (opts: any) => opts
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject unauthenticated request with 401', async () => {
    const event = mockEvent(null, { apiKey: 'token-123' })
    await expect(platformKeyPost(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  })

  it('should reject missing course context with 400', async () => {
    const event = mockEvent({ id: 'u1' }, { apiKey: 'token-123' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      currentCourse: null
    } as any)

    await expect(platformKeyPost(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Course context or LTI configuration missing'
    })
  })

  it('should reject non-teacher enrollment with 403', async () => {
    const event = mockEvent({ id: 'u1' }, { apiKey: 'token-123' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      currentCourse: {
        id: 'c1',
        deployment: {
          platform: { id: 'p1' }
        }
      }
    } as any)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      role: 'STUDENT'
    } as any)

    await expect(platformKeyPost(event)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  })

  it('should reject if user has no LtiIdentity on the platform with 400', async () => {
    const event = mockEvent({ id: 'u1' }, { apiKey: 'token-123' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      currentCourse: {
        id: 'c1',
        deployment: {
          platform: { id: 'p1' }
        }
      }
    } as any)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      role: 'TEACHER'
    } as any)
    vi.mocked(prisma.ltiIdentity.findUnique).mockResolvedValue(null)

    await expect(platformKeyPost(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'No LTI identity found. Please launch from the LMS first.'
    })
  })

  it('should update platformApiKey on user identity and return 200', async () => {
    const event = mockEvent({ id: 'u1' }, { apiKey: 'valid-canvas-token' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      currentCourse: {
        id: 'c1',
        deployment: {
          platform: { id: 'p1' }
        }
      }
    } as any)
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      role: 'TEACHER'
    } as any)
    vi.mocked(prisma.ltiIdentity.findUnique).mockResolvedValue({
      id: 'ident1',
      userId: 'u1',
      platformId: 'p1'
    } as any)
    vi.mocked(prisma.ltiIdentity.update).mockResolvedValue({
      id: 'ident1',
      platformApiKey: 'valid-canvas-token'
    } as any)

    const result = await platformKeyPost(event)

    expect(prisma.ltiIdentity.update).toHaveBeenCalledWith({
      where: {
        userId_platformId: {
          userId: 'u1',
          platformId: 'p1'
        }
      },
      data: {
        platformApiKey: 'valid-canvas-token'
      }
    })
    expect(result).toEqual({
      statusCode: 200,
      data: { success: true }
    })
  })
})
