import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import coursesGet from '../../../../../server/api/admin/courses.get'
import coursesPost from '../../../../../server/api/admin/courses.post'
import { getAllCourses, createCourse } from '../../../../../server/utils/courses'

// Mock dependencies
vi.mock('../../../../../server/utils/courses', () => ({
  getAllCourses: vi.fn(),
  createCourse: vi.fn()
}))

// Mock h3 utils
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    defineEventHandler: (handler: (event: any) => any) => handler,
    getValidatedQuery: vi.fn((event, validator) => validator(event.query || {})),
    readValidatedBody: vi.fn((event, validator) => validator(event.body || {})),
    createError: (opts: any) => opts
  }
})

// Mock generic event
const mockEvent = (userRole: string | null = 'ADMIN', query = {}, body = {}) =>
  ({
    context: {
      user: userRole ? { globalRole: userRole } : null
    },
    query,
    body
  }) as unknown as H3Event

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) => Promise.resolve({ user: event.context.user }))

describe('API: Admin Courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/courses', () => {
    it('should throw 403 if not admin', async () => {
      const event = mockEvent('USER')
      try {
        await coursesGet(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(403)
      }
    })

    it('should call getAllCourses with query params', async () => {
      const event = mockEvent('ADMIN', { d: 'dep1' })
      const mockCourses = [{ id: 'c1', title: 'Course 1' }]

      vi.mocked(getAllCourses).mockResolvedValue(mockCourses as any)

      const result = await coursesGet(event)

      expect(getAllCourses).toHaveBeenCalledWith({ d: 'dep1' })
      expect(result.data).toEqual(mockCourses)
    })
  })

  describe('POST /api/admin/courses', () => {
    it('should throw 403 if not admin', async () => {
      const event = mockEvent('USER')
      try {
        await coursesPost(event)
      } catch (e: any) {
        expect(e.statusCode).toBe(403)
      }
    })

    it('should call createCourse with validated body', async () => {
      const body = { title: 'New Course' }
      const event = mockEvent('ADMIN', {}, body)
      const mockCourse = { id: 'c1', title: 'New Course' }

      vi.mocked(createCourse).mockResolvedValue(mockCourse as any)

      const result = await coursesPost(event)

      expect(createCourse).toHaveBeenCalledWith(body)
      expect(result.statusCode).toBe(201)
      expect(result.data).toEqual(mockCourse)
    })
  })
})
