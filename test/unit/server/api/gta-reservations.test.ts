import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import reservationsPost from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/index.post'
import reservationDelete from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/[id].delete'
import myReservationGet from '@@/server/api/me/courses/[courseId]/assignments/[assignmentId]/interview-reservations/my.get'
import courseReservationsGet from '@@/server/api/me/courses/[courseId]/interview-reservations.get'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    },
    assignment: {
      findUnique: vi.fn()
    },
    gtaShift: {
      findMany: vi.fn()
    },
    gtaInterviewReservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn((cb: any) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb)))
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: Student GTA Interview Reservations', () => {
  const mockEvent = (
    user: any = { id: 'student-1', globalRole: 'USER' },
    body = {},
    params = { courseId: 'course-1', assignmentId: 'assign-1' }
  ) =>
    ({
      context: {
        user,
        params
      },
      node: { req: { method: 'GET' } },
      _body: body
    }) as any

  vi.mock('h3', async () => {
    const actual = await vi.importActual('h3')
    return {
      ...actual,
      defineEventHandler: (handler: any) => handler,
      readBody: (event: any) => Promise.resolve(event._body || {}),
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
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
      id: 'enr-student',
      userId: 'student-1',
      courseId: 'course-1',
      role: 'STUDENT'
    } as any)
  })

  describe('POST /api/me/courses/:courseId/assignments/:assignmentId/interview-reservations', () => {
    const futureSlot = '2099-10-05T14:10:00.000Z'

    it('successfully books slot and assigns an available GTA', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, { startTime: futureSlot })

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        hasInterviews: true,
        interviewWindowStart: null,
        interviewWindowEnd: null,
        course: { id: 'course-1', interviewLocation: 'McBryde 106' }
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null) // no existing active

      vi.mocked(prisma.gtaShift.findMany).mockResolvedValue([
        {
          id: 'shift-1',
          courseId: 'course-1',
          userId: 'gta-1',
          date: new Date('2099-10-05T00:00:00.000Z'),
          startTime: '10:00',
          endTime: '11:00'
        }
      ] as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([]) // no conflicting bookings

      vi.mocked(prisma.gtaInterviewReservation.create).mockResolvedValue({
        id: 'res-new',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        gtaId: 'gta-1',
        startTime: new Date(futureSlot),
        endTime: new Date('2099-10-05T14:15:00.000Z'),
        status: 'SCHEDULED',
        gta: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA' },
        assignment: { title: 'Project 1', course: { interviewLocation: 'McBryde 106' } }
      } as any)

      const res = await reservationsPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.id).toBe('res-new')
      expect(res.data.gtaId).toBe('gta-1')
      expect(prisma.gtaInterviewReservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignmentId: 'assign-1',
            studentId: 'student-1',
            gtaId: 'gta-1',
            startTime: new Date(futureSlot),
            endTime: new Date('2099-10-05T14:15:00.000Z'),
            status: 'SCHEDULED'
          })
        })
      )
    })

    it('rejects booking if student already has an active SCHEDULED reservation', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, { startTime: futureSlot })

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        hasInterviews: true,
        course: { id: 'course-1' }
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-existing',
        status: 'SCHEDULED'
      } as any)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: expect.stringContaining('already have an active scheduled interview')
        })
      )
    })

    it('rejects booking if requested timeslot is less than 2 hours in the future', async () => {
      const nearSlot = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, { startTime: nearSlot })

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: expect.stringContaining('at least 2 hours in advance')
        })
      )
    })

    it('reschedules an active SCHEDULED reservation atomically when rescheduleReservationId is provided', async () => {
      const event = mockEvent(
        { id: 'student-1', globalRole: 'USER' },
        { startTime: futureSlot, rescheduleReservationId: 'res-old' }
      )

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        hasInterviews: true,
        interviewWindowStart: null,
        interviewWindowEnd: null,
        course: { id: 'course-1', interviewLocation: 'McBryde 106' }
      } as any)

      // When checking reschedule reservation, find old reservation
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        id: 'res-old',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        status: 'SCHEDULED'
      } as any)

      // No OTHER active reservation exists
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

      vi.mocked(prisma.gtaShift.findMany).mockResolvedValue([
        {
          id: 'shift-1',
          courseId: 'course-1',
          userId: 'gta-1',
          date: new Date('2099-10-05T00:00:00.000Z'),
          startTime: '10:00',
          endTime: '11:00'
        }
      ] as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([])

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-old',
        status: 'CANCELLED'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.create).mockResolvedValue({
        id: 'res-new',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        gtaId: 'gta-1',
        startTime: new Date(futureSlot),
        endTime: new Date('2099-10-05T14:15:00.000Z'),
        status: 'SCHEDULED',
        gta: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA' },
        assignment: { title: 'Project 1', course: { interviewLocation: 'McBryde 106' } }
      } as any)

      const res = await reservationsPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.id).toBe('res-new')
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-old' },
          data: expect.objectContaining({ status: 'CANCELLED' })
        })
      )
      expect(prisma.gtaInterviewReservation.create).toHaveBeenCalled()
    })

    it('allows booking when previous reservation is CANCELLED', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, { startTime: futureSlot })

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        hasInterviews: true,
        course: { id: 'course-1' }
      } as any)

      // findFirst returns null because status is not SCHEDULED
      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

      vi.mocked(prisma.gtaShift.findMany).mockResolvedValue([
        {
          id: 'shift-1',
          courseId: 'course-1',
          userId: 'gta-1',
          date: new Date('2099-10-05T00:00:00.000Z'),
          startTime: '10:00',
          endTime: '11:00'
        }
      ] as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([])

      vi.mocked(prisma.gtaInterviewReservation.create).mockResolvedValue({
        id: 'res-new',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        gtaId: 'gta-1',
        startTime: new Date(futureSlot),
        endTime: new Date('2099-10-05T14:15:00.000Z'),
        status: 'SCHEDULED',
        gta: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA' },
        assignment: { title: 'Project 1', course: { interviewLocation: 'McBryde 106' } }
      } as any)

      const res = await reservationsPost(event)
      expect(res.statusCode).toBe(201)
      expect(res.data.id).toBe('res-new')
    })

    it('throws 409 if all on-duty GTAs for this slot are already booked', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, { startTime: futureSlot })

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 'assign-1',
        courseId: 'course-1',
        hasInterviews: true,
        course: { id: 'course-1' }
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue(null)

      vi.mocked(prisma.gtaShift.findMany).mockResolvedValue([
        {
          id: 'shift-1',
          courseId: 'course-1',
          userId: 'gta-1',
          date: new Date('2099-10-05T00:00:00.000Z'),
          startTime: '10:00',
          endTime: '11:00'
        }
      ] as any)

      // gta-1 is already booked by someone else
      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        { gtaId: 'gta-1' }
      ] as any)

      await expect(reservationsPost(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 409,
          statusMessage: expect.stringContaining('filled up')
        })
      )
    })
  })

  describe('DELETE /api/me/courses/:courseId/assignments/:assignmentId/interview-reservations/:id', () => {
    it('allows student to cancel their own SCHEDULED reservation', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, {}, {
        courseId: 'course-1',
        assignmentId: 'assign-1',
        id: 'res-1'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        status: 'SCHEDULED'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValue({
        id: 'res-1',
        status: 'CANCELLED'
      } as any)

      const res = await reservationDelete(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.success).toBe(true)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'CANCELLED' }
      })
    })

    it('rejects cancellation of COMPLETED reservation', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, {}, {
        courseId: 'course-1',
        assignmentId: 'assign-1',
        id: 'res-1'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        assignmentId: 'assign-1',
        studentId: 'student-1',
        status: 'COMPLETED'
      } as any)

      await expect(reservationDelete(event)).rejects.toThrowError(
        expect.objectContaining({
          statusCode: 400,
          statusMessage: expect.stringContaining('Cannot cancel')
        })
      )
    })
  })

  describe('GET /api/me/courses/:courseId/assignments/:assignmentId/interview-reservations/my', () => {
    it('returns student active reservation', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' })

      vi.mocked(prisma.gtaInterviewReservation.findFirst).mockResolvedValue({
        id: 'res-active',
        studentId: 'student-1',
        status: 'SCHEDULED',
        startTime: new Date('2099-10-05T10:00:00.000Z'),
        gta: { firstName: 'Alice', lastName: 'GTA' },
        assignment: { title: 'Project 1', course: { interviewLocation: 'McBryde 106' } }
      } as any)

      const res = await myReservationGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data.id).toBe('res-active')
      expect(res.data.status).toBe('SCHEDULED')
    })
  })

  describe('GET /api/me/courses/:courseId/interview-reservations', () => {
    it('returns all reservations for student in course', async () => {
      const event = mockEvent({ id: 'student-1', globalRole: 'USER' }, {}, {
        courseId: 'course-1'
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValue([
        {
          id: 'res-1',
          assignmentId: 'assign-1',
          studentId: 'student-1',
          status: 'SCHEDULED',
          startTime: new Date('2099-10-05T10:00:00.000Z'),
          assignment: { id: 'assign-1', title: 'Project 1' },
          gta: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA', email: 'alice@gta.edu' }
        }
      ] as any)

      const res = await courseReservationsGet(event)
      expect(res.statusCode).toBe(200)
      expect(res.data).toHaveLength(1)
      expect(res.data[0].id).toBe('res-1')
      expect(prisma.gtaInterviewReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 'student-1',
            assignment: { courseId: 'course-1' }
          }
        })
      )
    })
  })
})
