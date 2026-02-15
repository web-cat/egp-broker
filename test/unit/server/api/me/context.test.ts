import { describe, it, expect, vi, beforeEach } from 'vitest'
import contextPost from '../../../../../server/api/me/context.post'
import contextDelete from '../../../../../server/api/me/context.delete'
import { updateUserCurrentCourse } from '../../../../../server/utils/users'
import prisma from '../../../../../lib/prisma'

vi.mock('../../../../../server/utils/users', () => ({
  updateUserCurrentCourse: vi.fn()
}))

vi.mock('../../../../../lib/prisma', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    }
  }
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context.user, lti: event.lti })
)
vi.stubGlobal('setUserSession', vi.fn())
vi.stubGlobal('replaceUserSession', vi.fn())

describe('API: Me Context', () => {
  const mockEvent = (userRole: string | null = 'STUDENT', body = {}) =>
    ({
      context: {
        user: userRole ? { id: 'u1', globalRole: userRole } : null
      },
      node: {
        req: {
          method: 'POST' // or DELETE
        }
      },
      // Mocking readBody for POST
      body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => event.body,
      createError: (opts: any) => opts,
      setUserSession: vi.fn(),
      replaceUserSession: vi.fn()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should set context if enrolled', async () => {
      const event = mockEvent('STUDENT', { courseId: 'c1' })

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        course: { id: 'c1' }
      } as any)

      const result = await contextPost(event)

      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 'u1', courseId: 'c1' } },
        include: { course: true }
      })
      expect(updateUserCurrentCourse).toHaveBeenCalledWith('u1', 'c1')
      expect(result.data).toEqual({ success: true })
    })

    it('should fail if missing courseId', async () => {
      const event = mockEvent('STUDENT', {})

      try {
        await contextPost(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
      }
    })

    it('should fail if not enrolled', async () => {
      const event = mockEvent('STUDENT', { courseId: 'c1' })

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

      try {
        await contextPost(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(403)
      }
    })
  })

  describe('DELETE', () => {
    it('should clear context', async () => {
      const event = mockEvent('STUDENT')

      const result = await contextDelete(event)

      expect(updateUserCurrentCourse).toHaveBeenCalledWith('u1', null)
      expect(result.data).toEqual({ success: true })
    })
  })
})
