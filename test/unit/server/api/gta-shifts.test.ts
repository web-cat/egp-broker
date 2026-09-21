import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import gtaShiftsGet from '@@/server/api/me/courses/[courseId]/gta-shifts/index.get'
import gtaShiftsPost from '@@/server/api/me/courses/[courseId]/gta-shifts/index.post'
import gtaShiftPatch from '@@/server/api/me/courses/[courseId]/gta-shifts/[id].patch'
import gtaShiftDelete from '@@/server/api/me/courses/[courseId]/gta-shifts/[id].delete'
import gtaShiftsBatchPost from '@@/server/api/me/courses/[courseId]/gta-shifts/batch.post'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    },
    gtaShift: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    gtaInterviewReservation: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn()
    },
    $transaction: vi.fn((promises) => Promise.all(promises))
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Course GTA Shifts Endpoints', () => {
  const mockEvent = (
    user: any = { id: 'instructor-1', globalRole: 'USER' },
    body = {},
    params = { courseId: 'course-1' },
    query = {}
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body,
      _query: query
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
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

  describe('GET /api/me/courses/:courseId/gta-shifts', () => {
    it('throws 401 if unauthenticated', async () => {
      const event = mockEvent(null)
      await expect(gtaShiftsGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })

    it('throws 403 if user is not enrolled in the course', async () => {
      const event = mockEvent({ id: 'student-x', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null)

      await expect(gtaShiftsGet(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('returns shifts for enrolled student or instructor', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' })
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-1',
        userId: 'student-1',
        courseId: 'course-1',
        role: 'STUDENT'
      } as any)

      const mockShifts = [
        {
          id: 'shift-1',
          courseId: 'course-1',
          userId: 'gta-1',
          date: new Date('2026-09-18T00:00:00.000Z'),
          startTime: '10:00',
          endTime: '12:00',
          user: { firstName: 'Alice', lastName: 'GTA', email: 'alice@example.edu' }
        }
      ]
      vi.mocked(prisma.gtaShift.findMany).mockResolvedValue(mockShifts as any)

      const res = await gtaShiftsGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveLength(1)
      expect(res.data[0].id).toBe('shift-1')
    })
  })

  describe('POST /api/me/courses/:courseId/gta-shifts', () => {
    it('throws 403 if student tries to create a shift', async () => {
      const event = mockEvent(
        { id: 'student-1', globalRole: 'USER' },
        {
          userId: 'student-1',
          date: '2026-09-18',
          startTime: '10:00',
          endTime: '12:00'
        }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-1',
        userId: 'student-1',
        courseId: 'course-1',
        role: 'STUDENT'
      } as any)

      await expect(gtaShiftsPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })

    it('throws 400 if instructor tries to assign a shift to non-TA user', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        {
          userId: 'other-student',
          date: '2026-09-18',
          startTime: '10:00',
          endTime: '12:00'
        }
      )
      // Teacher check
      vi.mocked(prisma.enrollment.findUnique)
        .mockResolvedValueOnce({
          id: 'enr-teacher',
          userId: 'teacher-1',
          courseId: 'course-1',
          role: 'TEACHER'
        } as any)
        // Target user check
        .mockResolvedValueOnce({
          id: 'enr-other',
          userId: 'other-student',
          courseId: 'course-1',
          role: 'STUDENT'
        } as any)

      await expect(gtaShiftsPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 400 })
      )
    })

    it('allows teacher to create shift for a course TA', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        {
          userId: 'gta-1',
          date: '2026-09-18',
          startTime: '10:00',
          endTime: '12:00'
        }
      )
      vi.mocked(prisma.enrollment.findUnique)
        .mockResolvedValueOnce({
          id: 'enr-teacher',
          userId: 'teacher-1',
          courseId: 'course-1',
          role: 'TEACHER'
        } as any)
        .mockResolvedValueOnce({
          id: 'enr-ta',
          userId: 'gta-1',
          courseId: 'course-1',
          role: 'TA'
        } as any)

      vi.mocked(prisma.gtaShift.create).mockResolvedValue({
        id: 'shift-new',
        courseId: 'course-1',
        userId: 'gta-1',
        date: new Date('2026-09-18T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '12:00',
        user: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA' }
      } as any)

      const res = await gtaShiftsPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.id).toBe('shift-new')
      expect(prisma.gtaShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            courseId: 'course-1',
            userId: 'gta-1',
            date: new Date('2026-09-18T00:00:00.000Z'),
            startTime: '10:00',
            endTime: '12:00'
          }
        })
      )
    })

    it('allows GTA to create shift for themselves', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        {
          userId: 'gta-1',
          date: '2026-09-18',
          startTime: '10:00',
          endTime: '12:00'
        }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaShift.create).mockResolvedValue({
        id: 'shift-gta',
        courseId: 'course-1',
        userId: 'gta-1',
        date: new Date('2026-09-18T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '12:00'
      } as any)

      const res = await gtaShiftsPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.id).toBe('shift-gta')
    })

    it('throws 403 if GTA attempts to create shift for another GTA', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        {
          userId: 'gta-2',
          date: '2026-09-18',
          startTime: '10:00',
          endTime: '12:00'
        }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      await expect(gtaShiftsPost(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })
  })

  describe('PATCH /api/me/courses/:courseId/gta-shifts/:id', () => {
    it('throws 404 if shift does not exist or courseId mismatches', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        { startTime: '11:00' },
        { courseId: 'course-1', id: 'shift-missing' }
      )
      vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue(null)

      await expect(gtaShiftPatch(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 })
      )
    })

    it('allows teacher to update shift', async () => {
      const event = mockEvent(
        { id: 'teacher-1', globalRole: 'USER' },
        { startTime: '11:00', endTime: '13:00' },
        { courseId: 'course-1', id: 'shift-1' }
      )
      vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue({
        id: 'shift-1',
        courseId: 'course-1',
        userId: 'gta-1',
        date: new Date('2026-10-05T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '12:00'
      } as any)
      vi.mocked(prisma.enrollment.findUnique)
        .mockResolvedValueOnce({
          id: 'enr-teacher',
          userId: 'teacher-1',
          courseId: 'course-1',
          role: 'TEACHER'
        } as any)
        .mockResolvedValueOnce({
          id: 'enr-ta',
          userId: 'gta-1',
          courseId: 'course-1',
          role: 'TA'
        } as any)
      vi.mocked(prisma.gtaShift.update).mockResolvedValue({
        id: 'shift-1',
        startTime: '11:00',
        endTime: '13:00'
      } as any)

      const res = await gtaShiftPatch(event)
      expect(res.statusCode).toBe(200)
      expect(prisma.gtaShift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shift-1' },
          data: expect.objectContaining({
            startTime: '11:00',
            endTime: '13:00'
          })
        })
      )
    })
  })

  describe('DELETE /api/me/courses/:courseId/gta-shifts/:id', () => {
    it('allows owning GTA to delete their own shift', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        {},
        { courseId: 'course-1', id: 'shift-1' }
      )
      vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue({
        id: 'shift-1',
        courseId: 'course-1',
        userId: 'gta-1',
        date: new Date('2026-10-05T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '12:00'
      } as any)
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)
      vi.mocked(prisma.gtaShift.delete).mockResolvedValue({ id: 'shift-1' } as any)

      const res = await gtaShiftDelete(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.success).toBe(true)
      expect(prisma.gtaShift.delete).toHaveBeenCalledWith({ where: { id: 'shift-1' } })
    })

    it('throws 403 if another GTA tries to delete the shift', async () => {
      const event = mockEvent(
        { id: 'gta-2', globalRole: 'USER' },
        {},
        { courseId: 'course-1', id: 'shift-1' }
      )
      vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue({
        id: 'shift-1',
        courseId: 'course-1',
        userId: 'gta-1'
      } as any)
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta2',
        userId: 'gta-2',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      await expect(gtaShiftDelete(event)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })
  })

  describe('POST /api/me/courses/:courseId/gta-shifts/batch', () => {
    it('batch generates shifts across matching days of the week', async () => {
      const event = mockEvent(
        { id: 'gta-1', globalRole: 'USER' },
        {
          userId: 'gta-1',
          startDate: '2026-09-14', // Mon
          endDate: '2026-09-20', // Sun
          shifts: [
            { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }, // Mon
            { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' } // Wed
          ]
        }
      )
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 'enr-ta',
        userId: 'gta-1',
        courseId: 'course-1',
        role: 'TA'
      } as any)

      vi.mocked(prisma.gtaShift.create).mockResolvedValue({
        id: 'shift-batch',
        courseId: 'course-1',
        userId: 'gta-1'
      } as any)

      const res = await gtaShiftsBatchPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.count).toBe(2)
      expect(prisma.gtaShift.create).toHaveBeenCalledTimes(2)
    })
  })
})
