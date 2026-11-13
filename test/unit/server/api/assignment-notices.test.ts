import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import batchNoticesPost from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/batch.post'
import noticesGet from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/index.get'
import noticeDelete from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/notices/[studentId].delete'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    studentAssignmentNotice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn((callbacks) => {
      if (Array.isArray(callbacks)) {
        return Promise.all(callbacks)
      }
      return callbacks(prisma)
    })
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Student Assignment Notices Endpoints', () => {
  const mockEvent = (
    user: any = { id: 'teacher-1', globalRole: 'USER' },
    body: any = {},
    params: any = { courseId: 'course-1', assignmentId: 'assign-1', studentId: 'student-user-1' },
    query: any = {}
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'POST' } },
      _body: body,
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
      readValidatedBody: (event: any, validator: any) => {
        try {
          return validator(event._body || {})
        } catch (err: any) {
          throw Object.assign(new Error(err.message || 'Validation error'), {
            statusCode: 400,
            statusMessage: err.message || 'Bad Request',
            data: err
          })
        }
      },
      getQuery: (event: any) => event._query || {},
      getRouterParam: (event: any, name: string) => event.context?.params?.[name] || null,
      createError: (opts: any) => {
        const err = new Error(opts.statusMessage || 'Error')
        Object.assign(err, opts)
        return err
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/me/courses/:courseId/assignments/:assignmentId/notices/batch', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const event = mockEvent(null)
      await expect(batchNoticesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('rejects when courseId or assignmentId is missing with 400', async () => {
      const event = mockEvent({ id: 'teacher-1' }, {}, { courseId: '', assignmentId: '' })
      await expect(batchNoticesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('rejects non-staff (students) with 403', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-1',
        userId: 'student-1',
        courseId: 'course-1',
        role: 'STUDENT'
      } as any)

      await expect(batchNoticesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('rejects when assignment is not found in course with 404', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        { items: [{ studentIdentifier: 'user@test.edu', notice: 'Test notice' }] }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

      await expect(batchNoticesPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('successfully processes batch upload with email and studentId matching', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        {
          items: [
            { studentIdentifier: 'ALICE@Illinois.EDU', notice: 'Notice for Alice' },
            { studentIdentifier: '67890', notice: 'Notice for Bob' },
            { studentIdentifier: 'unknown@illinois.edu', notice: 'Unknown student' }
          ]
        }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        title: 'MP1'
      } as any)

      // Course enrollments for identifier resolution
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        {
          id: 'enr-alice',
          userId: 'user-alice',
          courseId: 'course-1',
          user: {
            id: 'user-alice',
            email: 'alice@illinois.edu',
            studentId: '12345'
          }
        },
        {
          id: 'enr-bob',
          userId: 'user-bob',
          courseId: 'course-1',
          user: {
            id: 'user-bob',
            email: 'bob@illinois.edu',
            studentId: '67890'
          }
        }
      ] as any)

      // Suppose Alice already had a notice (update), and Bob does not (create)
      vi.mocked(prisma.studentAssignmentNotice.findMany).mockResolvedValue([
        { studentId: 'user-alice' }
      ] as any)

      vi.mocked(prisma.studentAssignmentNotice.upsert).mockResolvedValue({} as any)

      const result = await batchNoticesPost(event)

      expect(result.statusCode).toBe(200)
      expect(result.data).toEqual({
        createdCount: 1,
        updatedCount: 1,
        unmatchedIdentifiers: ['unknown@illinois.edu'],
        totalProcessed: 3
      })

      expect(prisma.studentAssignmentNotice.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.studentAssignmentNotice.upsert).toHaveBeenCalledWith({
        where: {
          assignmentId_studentId: {
            assignmentId: 'assign-1',
            studentId: 'user-alice'
          }
        },
        create: {
          assignmentId: 'assign-1',
          studentId: 'user-alice',
          authorId: 'teacher-1',
          notice: 'Notice for Alice'
        },
        update: {
          authorId: 'teacher-1',
          notice: 'Notice for Alice'
        }
      })
    })

    it('allows TAs to batch upload notices', async () => {
      const event = mockEvent(
        { id: 'ta-1', globalRole: 'USER' },
        {
          items: [{ studentIdentifier: 'user-alice', notice: 'TA Notice' }]
        }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'ta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        title: 'MP1'
      } as any)

      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        {
          id: 'enr-alice',
          userId: 'user-alice',
          courseId: 'course-1',
          user: {
            id: 'user-alice',
            email: 'alice@illinois.edu',
            studentId: '12345'
          }
        }
      ] as any)

      vi.mocked(prisma.studentAssignmentNotice.findMany).mockResolvedValue([])
      vi.mocked(prisma.studentAssignmentNotice.upsert).mockResolvedValue({} as any)

      const res = await batchNoticesPost(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.createdCount).toBe(1)
      expect(res.data.updatedCount).toBe(0)
      expect(res.data.unmatchedIdentifiers).toEqual([])
    })

    it('returns 0 created/updated when all student identifiers are unmatched', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        {
          items: [{ studentIdentifier: 'unknown@illinois.edu', notice: 'Notice' }]
        }
      )

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1'
      } as any)

      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([])

      const res = await batchNoticesPost(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.createdCount).toBe(0)
      expect(res.data.updatedCount).toBe(0)
      expect(res.data.unmatchedIdentifiers).toEqual(['unknown@illinois.edu'])
    })
  })

  describe('GET /api/me/courses/:courseId/assignments/:assignmentId/notices', () => {
    it('rejects when courseId or assignmentId is missing with 400', async () => {
      const event = mockEvent({ id: 'teacher-1' }, {}, { courseId: '', assignmentId: '' })
      await expect(noticesGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('returns all notices for an assignment', async () => {
      const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        title: 'MP1'
      } as any)

      const mockNotices = [
        {
          id: 'notice-1',
          assignmentId: 'assign-1',
          studentId: 'student-1',
          authorId: 'teacher-1',
          notice: 'Check edge cases in problem 2',
          createdAt: new Date('2026-11-12T12:00:00Z'),
          updatedAt: new Date('2026-11-12T12:00:00Z'),
          student: {
            id: 'student-1',
            firstName: 'Alice',
            lastName: 'Smith',
            email: 'alice@example.com',
            studentId: 'U12345',
            avatarUrl: null
          },
          author: {
            id: 'teacher-1',
            firstName: 'Prof',
            lastName: 'X',
            email: 'profx@example.com'
          }
        }
      ]
      vi.mocked(prisma.studentAssignmentNotice.findMany).mockResolvedValue(mockNotices as any)

      const res = await noticesGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveLength(1)
      expect(res.data[0].id).toBe('notice-1')
      expect(res.data[0].notice).toBe('Check edge cases in problem 2')
    })

    it('rejects with 404 if assignment does not belong to course', async () => {
      const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null)

      await expect(noticesGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })
  })

  describe('DELETE /api/me/courses/:courseId/assignments/:assignmentId/notices/:studentId', () => {
    it('rejects when studentId is missing with 400', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        {},
        { courseId: 'course-1', assignmentId: 'assign-1', studentId: '' }
      )
      await expect(noticeDelete(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('deletes notice for student and returns success', async () => {
      const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        title: 'MP1'
      } as any)

      vi.mocked(prisma.studentAssignmentNotice.findUnique).mockResolvedValue({
        id: 'notice-1',
        assignmentId: 'assign-1',
        studentId: 'student-user-1'
      } as any)

      vi.mocked(prisma.studentAssignmentNotice.delete).mockResolvedValue({} as any)

      const res = await noticeDelete(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toEqual({ success: true })
      expect(prisma.studentAssignmentNotice.delete).toHaveBeenCalledWith({
        where: {
          assignmentId_studentId: {
            assignmentId: 'assign-1',
            studentId: 'student-user-1'
          }
        }
      })
    })

    it('returns 404 when notice to delete does not exist', async () => {
      const event = mockEvent({ id: 'teacher-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-teacher',
        userId: 'teacher-1',
        courseId: 'course-1',
        role: 'TEACHER'
      } as any)

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        title: 'MP1'
      } as any)

      vi.mocked(prisma.studentAssignmentNotice.findUnique).mockResolvedValue(null)

      await expect(noticeDelete(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })
  })
})
