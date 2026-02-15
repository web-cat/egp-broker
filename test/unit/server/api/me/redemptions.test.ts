import { describe, it, expect, vi, beforeEach } from 'vitest'
import redemptionsGet from '../../../../../server/api/me/redemptions.get'
import { getStudentRedemptions } from '../../../../../server/utils/redemptions'
import { getCurrentEnrollment } from '../../../../../server/utils/enrollments'
import prisma from '../../../../../lib/prisma'

vi.mock('../../../../../server/utils/redemptions', () => ({
  getStudentRedemptions: vi.fn()
}))

vi.mock('../../../../../server/utils/enrollments', () => ({
  getCurrentEnrollment: vi.fn()
}))

vi.mock('../../../../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context.user, lti: event.lti })
)

describe('API: Me Redemptions GET', () => {
  const mockEvent = (userRole: string | null = 'STUDENT') =>
    ({
      context: {
        user: userRole ? { id: 'u1', globalRole: userRole } : null
      },
      node: {
        req: {
          method: 'GET'
        }
      },
      lti: {}
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

  it('should return redemptions if enrollment found', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ currentCourseId: 'c1' } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({ courseId: 'c1' } as any)
    vi.mocked(getStudentRedemptions).mockResolvedValue([
      { id: 'r1', assignmentTitle: 'A1', cost: 1 } as any
    ])

    const result = await redemptionsGet(event)

    expect(getCurrentEnrollment).toHaveBeenCalledWith('u1', 'c1', expect.anything())
    expect(getStudentRedemptions).toHaveBeenCalledWith('u1', 'c1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('r1')
  })

  it('should return empty list if no enrollment', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ currentCourseId: null } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue(null)

    const result = await redemptionsGet(event)

    expect(getStudentRedemptions).not.toHaveBeenCalled()
    expect(result.data).toEqual([])
  })
})
