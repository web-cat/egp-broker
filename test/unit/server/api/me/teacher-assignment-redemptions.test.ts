import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/redemptions.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn()
    },
    passRedemption: {
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
    createError: (opts: any) => opts,
    getRouterParam: vi.fn().mockReturnValue('asg-1')
  }
})

describe('GET /api/me/assignments/:id/redemptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns assignment redemptions successfully for authorized teacher', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.passRedemption.findMany).mockResolvedValue([
      {
        id: 'red-1',
        cost: 1,
        createdAt: new Date('2026-08-25T10:00:00.000Z'),
        dueDate: new Date('2026-08-28T23:59:00.000Z'),
        acceptUntil: new Date('2026-08-28T23:59:00.000Z'),
        availableFrom: null,
        assignment: { id: 'asg-1', title: 'Homework 1' },
        pool: {
          user: {
            id: 'stu-1',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            enrollments: [{ courseSection: { name: 'Section A' } }]
          },
          passType: { name: 'Late Pass', hoursPerPass: 24 }
        }
      }
    ] as any)

    const event = {
      context: { user: { id: 'teacher-1', role: 'TEACHER' } }
    } as any
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(response.data).toHaveLength(1)
    expect(response.data[0].studentName).toBe('Alice Smith')
    expect(response.data[0].sectionName).toBe('Section A')
    expect(response.data[0].passTypeName).toBe('Late Pass')
  })
})
