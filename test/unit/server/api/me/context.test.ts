import { describe, it, expect, vi, beforeEach } from 'vitest'

import contextPost from '../../../../../server/api/me/context.post'
import contextDelete from '../../../../../server/api/me/context.delete'
import { updateUserCurrentCourse } from '../../../../../server/utils/users'
import prisma from '../../../../../lib/prisma'

// Move mock to top to ensure hoisting and application
vi.mock('h3', async () => {
  const actual = (await vi.importActual('h3')) as any
  return {
    ...actual,
    defineEventHandler: (handler: any) => handler,
    readBody: (event: any) => event.body,
    readValidatedBody: async (event: any, parser: any) => {
      try {
        return await parser(event.body)
      } catch (e: any) {
        const err = new Error('Validation Failed') as any
        err.statusCode = 400
        err.data = e
        throw err
      }
    },
    createError: (opts: any) => {
      const err = new Error(opts.statusMessage) as any
      err.statusCode = opts.statusCode
      err.data = opts.data
      return err
    },
    setUserSession: vi.fn(),
    replaceUserSession: vi.fn()
  }
})

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
      body
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should set context if enrolled', async () => {
      const validCuid = 'm8v1f98h1m27p36o4q5r2s1t'
      const event = mockEvent('STUDENT', { courseId: validCuid })

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        course: { id: validCuid }
      } as any)

      const result = await contextPost(event)

      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 'u1', courseId: validCuid } },
        include: { course: true }
      })
      expect(updateUserCurrentCourse).toHaveBeenCalledWith('u1', validCuid)
      expect(result.data).toEqual({ success: true })
    })

    it('should fail if missing courseId', async () => {
      const event = mockEvent('STUDENT', {})

      try {
        await contextPost(event)
        throw new Error('Should have failed')
      } catch (e: any) {
        expect(e.statusCode).toBe(400)
      }
    })

    it('should fail if not enrolled', async () => {
      const validCuid = 'm8v1f98h1m27p36o4q5r2s1t'
      const event = mockEvent('STUDENT', { courseId: validCuid })

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

      try {
        await contextPost(event)
        throw new Error('Should have failed')
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
