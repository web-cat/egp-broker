import { describe, it, expect, vi, beforeEach } from 'vitest'
import passPoolsGet from '../../../../../server/api/me/pass-pools.get'
import { getStudentPassPools } from '../../../../../server/utils/pass-types'
import { getCurrentEnrollment } from '../../../../../server/utils/enrollments'
import prisma from '@@/server/utils/db'

vi.mock('../../../../../server/utils/pass-types', () => ({
  getStudentPassPools: vi.fn()
}))

vi.mock('../../../../../server/utils/enrollments', () => ({
  getCurrentEnrollment: vi.fn()
}))

vi.mock('@@/server/utils/db', () => ({
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

describe('API: Me Pass Pools GET', () => {
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

  it('should return pools if enrollment found', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ currentCourseId: 'c1' } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue({ courseId: 'c1' } as any)
    vi.mocked(getStudentPassPools).mockResolvedValue([
      { id: 'p1', name: 'Pass 1', balance: 3 }
    ] as any)

    const result = await passPoolsGet(event)

    expect(getCurrentEnrollment).toHaveBeenCalledWith('u1', 'c1', expect.anything())
    expect(getStudentPassPools).toHaveBeenCalledWith('u1', 'c1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('p1')
  })

  it('should return empty list if no enrollment', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ currentCourseId: null } as any)
    vi.mocked(getCurrentEnrollment).mockResolvedValue(null)

    const result = await passPoolsGet(event)

    expect(getStudentPassPools).not.toHaveBeenCalled()
    expect(result.data).toEqual([])
  })
})
