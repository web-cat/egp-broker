import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../../../../../server/api/me/assignments/[id]/overrides.get'
import prisma from '@@/server/utils/db'

vi.mock('@@/server/utils/db', () => ({
  default: {
    user: {
      findUnique: vi.fn()
    },
    assignmentOverride: {
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

describe('GET /api/me/assignments/:id/overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns assignment overrides successfully for authorized teacher', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'teacher-1',
      currentCourseId: 'course-1',
      role: 'TEACHER'
    } as any)

    vi.mocked(prisma.assignmentOverride.findMany).mockResolvedValue([
      {
        id: 'ov-1',
        title: 'Section 001 Accommodation',
        courseSectionId: 'sec-1',
        availableFrom: new Date('2026-08-20T00:00:00.000Z'),
        dueDate: new Date('2026-09-02T23:59:00.000Z'),
        acceptUntil: new Date('2026-09-05T23:59:00.000Z'),
        courseSection: { id: 'sec-1', name: 'Section 001' },
        studentOverrides: []
      },
      {
        id: 'ov-2',
        title: 'Extra Time Student Override',
        courseSectionId: null,
        availableFrom: null,
        dueDate: new Date('2026-09-04T23:59:00.000Z'),
        acceptUntil: null,
        courseSection: null,
        studentOverrides: [
          {
            user: {
              id: 'stu-1',
              firstName: 'Alice',
              lastName: 'Smith',
              email: 'alice@example.com'
            }
          }
        ]
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
    expect(res.data[0]).toMatchObject({
      id: 'ov-1',
      title: 'Section 001 Accommodation',
      type: 'SECTION',
      targetName: 'Section: Section 001',
      dueDate: '2026-09-02T23:59:00.000Z'
    })
    expect(res.data[1]).toMatchObject({
      id: 'ov-2',
      type: 'STUDENT',
      targetName: 'Student(s): Alice Smith',
      dueDate: '2026-09-04T23:59:00.000Z'
    })
  })
})
