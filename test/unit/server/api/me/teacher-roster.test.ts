import { describe, it, expect, vi, beforeEach } from 'vitest'
import rosterHandler from '../../../../../server/api/me/students/index.get'
import studentHistoryHandler from '../../../../../server/api/me/students/[id]/redemptions.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    passType: {
      findMany: vi.fn()
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
    getRouterParam: vi.fn().mockReturnValue('stu-1')
  }
})

describe('Teacher Student Roster & History APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns student roster with pass balances and redemptions count', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.passType.findMany).mockResolvedValue([
      { id: 'pt-1', name: 'Late Pass', initialBalance: 3 }
    ] as any)

    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      {
        id: 'en-stu-1',
        courseSection: { name: 'Section B' },
        user: {
          id: 'stu-1',
          firstName: 'Charlie',
          lastName: 'Brown',
          email: 'charlie@example.com',
          passPools: [
            {
              id: 'pool-1',
              passTypeId: 'pt-1',
              balance: 2,
              passType: { name: 'Late Pass' },
              redemptions: [{ id: 'red-1' }]
            }
          ]
        }
      }
    ] as any)

    const event = {
      context: { user: { id: 'teacher-1', role: 'TEACHER' } }
    } as any
    const response = await rosterHandler(event)

    expect(response.statusCode).toBe(200)
    expect(response.data).toHaveLength(1)
    expect(response.data[0].studentName).toBe('Charlie Brown')
    expect(response.data[0].sectionName).toBe('Section B')
    expect(response.data[0].totalRedemptions).toBe(1)
    expect(response.data[0].passBalances).toHaveLength(1)
    expect(response.data[0].passBalances[0].balance).toBe(2)
  })

  it('returns redemption history for a specific student', async () => {
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
        acceptUntil: null,
        assignment: { id: 'asg-1', title: 'Homework 1' },
        pool: {
          passType: { name: 'Late Pass', hoursPerPass: 24 }
        }
      }
    ] as any)

    const event = {
      context: { user: { id: 'teacher-1', role: 'TEACHER' } }
    } as any
    const response = await studentHistoryHandler(event)

    expect(response.statusCode).toBe(200)
    expect(response.data).toHaveLength(1)
    expect(response.data[0].assignmentTitle).toBe('Homework 1')
    expect(response.data[0].passTypeName).toBe('Late Pass')
  })
})
