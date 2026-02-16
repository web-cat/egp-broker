import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireCourseContext } from '../../../../server/utils/session'
import type { H3Event } from 'h3'

import prisma from '@@/lib/prisma'

// Mock dependencies
vi.mock('@@/server/utils/session', async () => {
  const actual = await vi.importActual('@@/server/utils/session')
  return {
    ...actual,
    getUserSession: vi.fn()
  }
})

// Mock prisma
vi.mock('@@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    }
  }
}))

describe('requireCourseContext', () => {
  let mockEvent: H3Event

  beforeEach(() => {
    mockEvent = {} as H3Event
    vi.clearAllMocks()
  })

  it('throws 401 if user is not logged in', async () => {
    // Mock getUserSession to return empty session
    // @ts-expect-error - mocking global
    global.getUserSession = vi.fn().mockResolvedValue({})

    await expect(requireCourseContext(mockEvent)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 401 })
    )
  })

  it('throws 403 if user has no current course selected', async () => {
    // Mock getUserSession to return user
    // @ts-expect-error - mocking global
    global.getUserSession = vi.fn().mockResolvedValue({ user: { id: 'user1' } })

    // Mock prisma to return user without courseId
    // @ts-expect-error - mocking prisma
    prisma.user.findUnique.mockResolvedValue({ currentCourseId: null })

    await expect(requireCourseContext(mockEvent)).rejects.toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('returns courseId if context exists', async () => {
    // Mock getUserSession to return user
    // @ts-expect-error - mocking global
    global.getUserSession = vi.fn().mockResolvedValue({ user: { id: 'user1' } })

    // Mock prisma to return user WITH courseId
    // @ts-expect-error - mocking prisma
    prisma.user.findUnique.mockResolvedValue({ currentCourseId: 'course123' })

    const result = await requireCourseContext(mockEvent)
    expect(result).toBe('course123')
  })
})
