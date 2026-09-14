import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import {
  isPlainCanvasOrNewQuizzes,
  findInstructorCanvasApiKey,
  syncCbtfReservationCanvasOverride,
  deleteCbtfReservationCanvasOverride
} from '@@/server/utils/cbtf-canvas'
import * as canvasModule from '@@/server/utils/canvas'
import * as alertService from '@@/server/services/alert.service'

vi.mock('@@/server/services/alert.service', () => ({
  notifyCbtfCanvasOverrideFailure: vi.fn().mockResolvedValue(true),
  sendAdminAlert: vi.fn().mockResolvedValue(true)
}))

describe('CBTF Canvas Override Coordinator (cbtf-canvas)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isPlainCanvasOrNewQuizzes', () => {
    it('returns true when assignment has no external tool', () => {
      expect(isPlainCanvasOrNewQuizzes({ tool: null })).toBe(true)
      expect(isPlainCanvasOrNewQuizzes({})).toBe(true)
    })

    it('returns true for New Quizzes engine hosted on instructure.com domain', () => {
      expect(
        isPlainCanvasOrNewQuizzes({
          tool: { baseUrl: 'https://quiz-lti-iad-prod.instructure.com' }
        })
      ).toBe(true)
      expect(
        isPlainCanvasOrNewQuizzes({
          tool: { baseUrl: 'https://canvas.instructure.com/api/v1' }
        })
      ).toBe(true)
    })

    it('returns false for external third-party LTI tools', () => {
      expect(
        isPlainCanvasOrNewQuizzes({
          tool: { baseUrl: 'https://codeworkout.cs.vt.edu' }
        })
      ).toBe(false)
      expect(
        isPlainCanvasOrNewQuizzes({
          tool: { baseUrl: 'https://prairielearn.engr.illinois.edu' }
        })
      ).toBe(false)
    })
  })

  describe('findInstructorCanvasApiKey', () => {
    it('prioritizes section instructor API key when available', async () => {
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValueOnce({
        user: {
          ltiIdentities: [{ platformApiKey: 'section-instructor-key' }]
        }
      } as any)

      const key = await findInstructorCanvasApiKey('course-1', 'sec-1', 'plat-1')
      expect(key).toBe('section-instructor-key')
      expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            courseSectionId: 'sec-1',
            role: { in: ['TEACHER', 'TA'] }
          })
        })
      )
    })

    it('falls back to course instructor key if section instructor has no key', async () => {
      vi.spyOn(prisma.enrollment, 'findFirst')
        .mockResolvedValueOnce(null) // Section search returns null
        .mockResolvedValueOnce({
          user: {
            ltiIdentities: [{ platformApiKey: 'course-instructor-key' }]
          }
        } as any) // Course search returns teacher

      const key = await findInstructorCanvasApiKey('course-1', 'sec-1', 'plat-1')
      expect(key).toBe('course-instructor-key')
      expect(prisma.enrollment.findFirst).toHaveBeenCalledTimes(2)
    })

    it('returns null when no instructor key is found', async () => {
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue(null)

      const key = await findInstructorCanvasApiKey('course-1', null, 'plat-1')
      expect(key).toBeNull()
    })
  })

  describe('syncCbtfReservationCanvasOverride', () => {
    const mockReservation: any = {
      id: 'res-100',
      assignmentId: 'asg-100',
      userId: 'user-std-1',
      seatNumber: 15,
      startTime: new Date('2026-09-15T14:00:00Z'),
      endTime: new Date('2026-09-15T15:00:00Z'),
      status: 'SCHEDULED',
      canvasOverrideId: null,
      assignment: {
        id: 'asg-100',
        title: 'Midterm Quiz',
        canvasAssignmentId: '456',
        toolId: null,
        tool: null,
        courseId: 'course-100',
        course: {
          id: 'course-100',
          title: 'CS 101',
          canvasCourseId: '123',
          deployment: {
            deploymentHost: 'canvas.vt.edu',
            platformId: 'plat-100',
            platform: {
              issuer: 'https://canvas.instructure.com'
            }
          }
        }
      },
      user: {
        id: 'user-std-1',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@vt.edu',
        ltiIdentities: [
          {
            platformId: 'plat-100',
            platformUserId: '9876'
          }
        ],
        enrollments: [
          {
            courseId: 'course-100',
            courseSectionId: 'sec-100'
          }
        ]
      }
    }

    it('skips sync when assignment has an external third-party LTI tool', async () => {
      const reservationWithTool = {
        ...mockReservation,
        assignment: {
          ...mockReservation.assignment,
          toolId: 'tool-ext',
          tool: { baseUrl: 'https://codeworkout.cs.vt.edu' }
        }
      }
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(reservationWithTool as any)

      const result = await syncCbtfReservationCanvasOverride('res-100')
      expect(result.status).toBe('skipped')
      expect(result.reason).toBe('external_tool')
    })

    it('creates an individual Canvas override when none exists and instructor key is available', async () => {
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(mockReservation as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      const createOverrideSpy = vi
        .spyOn(canvasModule, 'createCanvasAssignmentOverride')
        .mockResolvedValue({
          id: 5555,
          assignment_id: 456,
          title: 'CBTF Exam Slot',
          student_ids: [9876],
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        })

      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)
      vi.spyOn(prisma.assignmentOverride, 'upsert').mockResolvedValue({ id: 'local-ov-1' } as any)
      vi.spyOn(prisma.assignmentOverrideStudent, 'upsert').mockResolvedValue({} as any)

      const result = await syncCbtfReservationCanvasOverride('res-100')

      expect(result.status).toBe('created')
      expect(result.overrideId).toBe('5555')
      expect(createOverrideSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '123',
        '456',
        {
          student_ids: [9876],
          title: 'CBTF Exam Slot',
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        },
        'teacher-key-1'
      )
      expect(updateReservationSpy).toHaveBeenCalledWith({
        where: { id: 'res-100' },
        data: { canvasOverrideId: '5555' }
      })
    })

    it('updates existing Canvas override on reschedule when canvasOverrideId is present', async () => {
      const existingRes = {
        ...mockReservation,
        canvasOverrideId: '5555'
      }
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(existingRes as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      const updateOverrideSpy = vi
        .spyOn(canvasModule, 'updateCanvasAssignmentOverride')
        .mockResolvedValue({
          id: 5555,
          assignment_id: 456,
          title: 'CBTF Exam Slot',
          student_ids: [9876],
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        })
      vi.spyOn(prisma.assignmentOverride, 'updateMany').mockResolvedValue({ count: 1 } as any)

      const result = await syncCbtfReservationCanvasOverride('res-100')

      expect(result.status).toBe('updated')
      expect(result.overrideId).toBe('5555')
      expect(updateOverrideSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '123',
        '456',
        '5555',
        {
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        },
        'teacher-key-1'
      )
    })

    it('handles Canvas API failure gracefully and dispatches ntfy alert (Option A)', async () => {
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(mockReservation as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      vi.spyOn(canvasModule, 'createCanvasAssignmentOverride').mockRejectedValue(
        new Error('Canvas 422: Unprocessable Entity')
      )

      const result = await syncCbtfReservationCanvasOverride('res-100')

      expect(result.status).toBe('error')
      expect(result.error).toContain('Canvas 422')
      expect(alertService.notifyCbtfCanvasOverrideFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentTitle: 'Midterm Quiz',
          error: expect.stringContaining('Canvas 422')
        })
      )
    })
  })

  describe('deleteCbtfReservationCanvasOverride', () => {
    it('deletes Canvas override when reservation has canvasOverrideId', async () => {
      const reservationWithOverride: any = {
        id: 'res-100',
        canvasOverrideId: '5555',
        assignment: {
          canvasAssignmentId: '456',
          course: {
            canvasCourseId: '123',
            deployment: {
              deploymentHost: 'canvas.vt.edu',
              platformId: 'plat-100',
              platform: { issuer: 'https://canvas.instructure.com' }
            }
          }
        },
        user: {
          enrollments: [{ courseId: 'course-100', courseSectionId: 'sec-100' }]
        }
      }
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(
        reservationWithOverride as any
      )
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      const deleteSpy = vi
        .spyOn(canvasModule, 'deleteCanvasAssignmentOverride')
        .mockResolvedValue(undefined)
      vi.spyOn(prisma.cbtfReservation, 'update').mockResolvedValue({} as any)
      vi.spyOn(prisma.assignmentOverride, 'deleteMany').mockResolvedValue({ count: 1 } as any)

      const deleted = await deleteCbtfReservationCanvasOverride('res-100')
      expect(deleted).toBe(true)
      expect(deleteSpy).toHaveBeenCalledWith('canvas.vt.edu', '123', '456', '5555', 'teacher-key-1')
    })
  })
})
