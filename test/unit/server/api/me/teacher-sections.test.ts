import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/sections/index.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    courseSection: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('@@/server/utils/enrollments', () => ({
  getCurrentEnrollment: vi.fn().mockResolvedValue({
    id: 'en-1',
    userId: 'teacher-1',
    courseId: 'course-1',
    role: 'TEACHER'
  })
}))

// Mock global getUserSession
vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || { id: 'teacher-1', role: 'TEACHER' } })
)

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    defineEventHandler: (fn: any) => fn,
    createError: (opts: any) => opts
  }
})

describe('GET /api/me/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns course sections with counts for authorized teacher', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      globalRole: 'USER'
    } as any)

    vi.mocked(prisma.courseSection.findMany).mockResolvedValue([
      {
        id: 'sec-1',
        name: 'Section 001',
        canvasSectionId: '101',
        _count: {
          enrollments: 25,
          overrides: 2
        }
      },
      {
        id: 'sec-2',
        name: 'Section 002',
        canvasSectionId: '102',
        _count: {
          enrollments: 18,
          overrides: 0
        }
      }
    ] as any)

    const event = {
      context: {
        user: { id: 'teacher-1', role: 'TEACHER' }
      }
    } as any

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    expect(res.data).toHaveLength(2)
    expect(res.data[0]).toEqual({
      id: 'sec-1',
      name: 'Section 001',
      canvasSectionId: '101',
      totalStudents: 25,
      totalOverrides: 2
    })
  })
})
