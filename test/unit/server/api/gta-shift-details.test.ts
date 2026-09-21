import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import shiftDetailsGet from '@@/server/api/me/courses/[courseId]/gta-shifts/[id]/details.get'
import interviewReschedulePost from '@@/server/api/me/courses/[courseId]/interviews/[id]/reschedule.post'
import interviewCancelPost from '@@/server/api/me/courses/[courseId]/interviews/[id]/cancel.post'

vi.mock('@@/server/utils/db', () => ({
  default: {
    enrollment: {
      findUnique: vi.fn()
    },
    gtaShift: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    gtaInterviewReservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.stubGlobal('getUserSession', (event: any) =>
  Promise.resolve({ user: event.context?.user || null })
)

describe('API: GTA Shift Details & Interview Reschedule/Cancel', () => {
  const mockEvent = (
    user: any = { id: 'instructor-1', globalRole: 'USER' },
    body = {},
    params = { courseId: 'course-1', id: 'shift-1' }
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
      role: 'TEACHER'
    } as any)
  })

  describe('GET /api/me/courses/:courseId/gta-shifts/:id/details', () => {
    it('returns slots with vacant and reserved statuses and identifies available GTAs', async () => {
      vi.mocked(prisma.gtaShift.findUnique).mockResolvedValue({
        id: 'shift-1',
        courseId: 'course-1',
        userId: 'gta-1',
        date: new Date('2026-10-05T00:00:00.000Z'),
        startTime: '10:00',
        endTime: '10:30',
        user: {
          id: 'gta-1',
          firstName: 'Alice',
          lastName: 'GTA',
          email: 'alice@vt.edu',
          avatarUrl: null
        }
      } as any)

      // Active reservation at 10:00 - 10:10 EDT (14:00 UTC)
      vi.mocked(prisma.gtaInterviewReservation.findMany)
        .mockResolvedValueOnce([
          {
            id: 'res-1',
            studentId: 'student-1',
            assignmentId: 'assign-1',
            gtaId: 'gta-1',
            startTime: new Date('2026-10-05T14:00:00.000Z'),
            endTime: new Date('2026-10-05T14:05:00.000Z'),
            status: 'SCHEDULED',
            student: {
              id: 'student-1',
              firstName: 'Bob',
              lastName: 'Student',
              email: 'bob@vt.edu'
            },
            assignment: {
              id: 'assign-1',
              title: 'Project 1'
            }
          }
        ] as any)
        // All active reservations
        .mockResolvedValueOnce([])

      // Concurrent shift for Charlie covering 10:00 - 10:30
      vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([
        {
          id: 'shift-2',
          userId: 'gta-2',
          startTime: '10:00',
          endTime: '11:00',
          user: {
            id: 'gta-2',
            firstName: 'Charlie',
            lastName: 'Assistant',
            email: 'charlie@vt.edu'
          }
        }
      ] as any)

      const res = await shiftDetailsGet(mockEvent())
      expect(res.statusCode).toBe(200)
      expect(res.data.totalSlots).toBe(3) // 10:00, 10:10, 10:20
      expect(res.data.reservedCount).toBe(1)
      expect(res.data.vacantCount).toBe(2)

      const slot1 = res.data.slots[0]
      expect(slot1.isReserved).toBe(true)
      expect(slot1.reservation?.studentName).toBe('Bob Student')
      expect(slot1.canReschedule).toBe(true)
      expect(slot1.availableGtas).toHaveLength(1)
      expect(slot1.availableGtas[0].name).toBe('Charlie Assistant')

      const slot2 = res.data.slots[1]
      expect(slot2.isReserved).toBe(false)
      expect(slot2.canReschedule).toBe(false)
    })
  })

  describe('POST /api/me/courses/:courseId/interviews/:id/reschedule', () => {
    it('reschedules reservation to an available concurrent GTA', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        status: 'SCHEDULED',
        startTime: new Date('2026-10-05T14:00:00.000Z'),
        endTime: new Date('2026-10-05T14:05:00.000Z'),
        assignment: { courseId: 'course-1' },
        gta: { id: 'gta-1', firstName: 'Alice', lastName: 'GTA', email: 'alice@vt.edu' },
        student: { id: 'student-1', firstName: 'Bob', lastName: 'Student', email: 'bob@vt.edu' }
      } as any)

      vi.mocked(prisma.gtaShift.findMany).mockResolvedValueOnce([
        {
          id: 'shift-2',
          userId: 'gta-2',
          startTime: '10:00',
          endTime: '11:00',
          user: { id: 'gta-2', firstName: 'Charlie', lastName: 'GTA', email: 'charlie@vt.edu' }
        }
      ] as any)

      vi.mocked(prisma.gtaInterviewReservation.findMany).mockResolvedValueOnce([])

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValueOnce({
        id: 'res-1',
        gtaId: 'gta-2'
      } as any)

      const res = await interviewReschedulePost(
        mockEvent(
          { id: 'instructor-1', globalRole: 'USER' },
          { targetGtaId: 'gta-2' },
          {
            courseId: 'course-1',
            id: 'res-1'
          }
        )
      )

      expect(res.statusCode).toBe(200)
      expect(res.data.success).toBe(true)
      expect(res.data.newGta.name).toBe('Charlie GTA')
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: { gtaId: 'gta-2' }
        })
      )
    })
  })

  describe('POST /api/me/courses/:courseId/interviews/:id/cancel', () => {
    it('cancels scheduled interview reservation', async () => {
      vi.mocked(prisma.gtaInterviewReservation.findUnique).mockResolvedValue({
        id: 'res-1',
        gtaId: 'gta-1',
        status: 'SCHEDULED',
        assignment: { courseId: 'course-1' }
      } as any)

      vi.mocked(prisma.gtaInterviewReservation.update).mockResolvedValueOnce({
        id: 'res-1',
        status: 'CANCELLED'
      } as any)

      const res = await interviewCancelPost(
        mockEvent(
          { id: 'instructor-1', globalRole: 'USER' },
          {},
          {
            courseId: 'course-1',
            id: 'res-1'
          }
        )
      )

      expect(res.statusCode).toBe(200)
      expect(res.data.success).toBe(true)
      expect(prisma.gtaInterviewReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: { status: 'CANCELLED' }
        })
      )
    })
  })
})
