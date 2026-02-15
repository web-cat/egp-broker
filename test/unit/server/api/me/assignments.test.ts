import { describe, it, expect, vi, beforeEach } from 'vitest'
import assignmentsGet from '../../../../../server/api/me/assignments.get'
import { getCourseAssignments } from '../../../../../server/utils/assignments'
import prisma from '../../../../../lib/prisma'

vi.mock('../../../../../server/utils/assignments', () => ({
  getCourseAssignments: vi.fn()
}))

vi.mock('../../../../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Me Assignments GET', () => {
  const mockEvent = (userRole: string | null = 'STUDENT') =>
    ({
      context: {
        user: userRole ? { id: 'u1', globalRole: userRole } : null
      },
      node: {
        req: {
          method: 'GET'
        }
      }
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

  it('should return assignments if user has current course context', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourseId: 'c1'
    } as any)

    const mockAssignments = [{ id: 'a1', title: 'Assignment 1' }]
    vi.mocked(getCourseAssignments).mockResolvedValue(mockAssignments as any)

    const result = await assignmentsGet(event)

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { currentCourseId: true }
    })
    expect(getCourseAssignments).toHaveBeenCalledWith('c1')
    expect(result.data).toEqual(mockAssignments)
  })

  it('should return empty list if no course context', async () => {
    const event = mockEvent()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      currentCourseId: null
    } as any)

    const result = await assignmentsGet(event)

    expect(getCourseAssignments).not.toHaveBeenCalled()
    expect(result.data).toEqual([])
  })
})
