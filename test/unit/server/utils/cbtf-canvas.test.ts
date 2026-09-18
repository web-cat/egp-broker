import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@@/server/utils/db'
import {
  isPlainCanvasOrNewQuizzes,
  findInstructorCanvasApiKey,
  syncCbtfReservationCanvasOverride,
  deleteCbtfReservationCanvasOverride,
  resyncAssignmentCbtfOverrides
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

    it('adopts and updates existing Canvas override when student already has an override targeting them on Canvas', async () => {
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(mockReservation as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      // Mock fetchCanvasAssignmentOverrides returning an existing override for student 9876
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 8888,
          assignment_id: 456,
          title: 'Old CBTF Slot',
          student_ids: [9876],
          unlock_at: '2026-09-10T14:00:00.000Z',
          due_at: '2026-09-10T15:00:00.000Z',
          lock_at: '2026-09-10T15:00:00.000Z'
        } as any
      ])

      const updateOverrideSpy = vi
        .spyOn(canvasModule, 'updateCanvasAssignmentOverride')
        .mockResolvedValue({
          id: 8888,
          assignment_id: 456,
          title: 'CBTF Exam Slot',
          student_ids: [9876],
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        })
      const createOverrideSpy = vi.spyOn(canvasModule, 'createCanvasAssignmentOverride')
      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)
      vi.spyOn(prisma.assignmentOverride, 'upsert').mockResolvedValue({ id: 'local-ov-1' } as any)
      vi.spyOn(prisma.assignmentOverrideStudent, 'upsert').mockResolvedValue({} as any)

      const result = await syncCbtfReservationCanvasOverride('res-100')

      expect(result.status).toBe('updated')
      expect(result.overrideId).toBe('8888')
      expect(createOverrideSpy).not.toHaveBeenCalled()
      expect(updateOverrideSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '123',
        '456',
        '8888',
        expect.any(Object),
        'teacher-key-1'
      )
      expect(updateReservationSpy).toHaveBeenCalledWith({
        where: { id: 'res-100' },
        data: { canvasOverrideId: '8888' }
      })
    })

    it('adopts existing Canvas override ID from prior reservation for the same student and assignment in database', async () => {
      vi.spyOn(prisma.cbtfReservation, 'findUnique').mockResolvedValue(mockReservation as any)
      vi.spyOn(prisma.cbtfReservation, 'findFirst').mockResolvedValue({
        id: 'res-prior',
        canvasOverrideId: '7777'
      } as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key-1' }] }
      } as any)

      const updateOverrideSpy = vi
        .spyOn(canvasModule, 'updateCanvasAssignmentOverride')
        .mockResolvedValue({
          id: 7777,
          assignment_id: 456,
          title: 'CBTF Exam Slot',
          student_ids: [9876],
          unlock_at: '2026-09-15T14:00:00.000Z',
          due_at: '2026-09-15T15:00:00.000Z',
          lock_at: '2026-09-15T15:00:00.000Z'
        })
      const createOverrideSpy = vi.spyOn(canvasModule, 'createCanvasAssignmentOverride')
      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)
      vi.spyOn(prisma.assignmentOverride, 'upsert').mockResolvedValue({ id: 'local-ov-1' } as any)
      vi.spyOn(prisma.assignmentOverrideStudent, 'upsert').mockResolvedValue({} as any)

      const result = await syncCbtfReservationCanvasOverride('res-100')

      expect(result.status).toBe('updated')
      expect(result.overrideId).toBe('7777')
      expect(createOverrideSpy).not.toHaveBeenCalled()
      expect(updateOverrideSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '123',
        '456',
        '7777',
        expect.any(Object),
        'teacher-key-1'
      )
      expect(updateReservationSpy).toHaveBeenCalledWith({
        where: { id: 'res-100' },
        data: { canvasOverrideId: '7777' }
      })
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

  describe('resyncAssignmentCbtfOverrides', () => {
    const mockAssignment: any = {
      id: 'asg-200',
      title: 'Final Exam',
      isSchedulable: true,
      canvasAssignmentId: '789',
      toolId: null,
      tool: null,
      courseId: 'course-200',
      course: {
        id: 'course-200',
        title: 'CS 2114',
        canvasCourseId: '321',
        deployment: {
          deploymentHost: 'canvas.vt.edu',
          platformId: 'plat-200',
          platform: { issuer: 'https://canvas.instructure.com' }
        }
      }
    }

    it('returns empty result when no active reservations exist', async () => {
      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany').mockResolvedValue([])

      const result = await resyncAssignmentCbtfOverrides('asg-200')
      expect(result).toEqual({
        totalChecked: 0,
        matched: 0,
        updated: 0,
        created: 0,
        changedOrCreated: 0,
        seatsReassigned: 0,
        conflicts: 0,
        errors: 0,
        details: []
      })
    })

    it('identifies matching override and does not call update API', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-201',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        startTime,
        endTime,
        status: 'SCHEDULED',
        canvasOverrideId: '9001',
        user: {
          id: 'user-std-1',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany').mockResolvedValue([mockReservation] as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      // Canvas already has override matching exact times
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 9001,
          assignment_id: 789,
          title: 'CBTF Exam Slot',
          student_ids: [5001],
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        }
      ])
      const updateSpy = vi.spyOn(canvasModule, 'updateCanvasAssignmentOverride')
      const createSpy = vi.spyOn(canvasModule, 'createCanvasAssignmentOverride')

      const result = await resyncAssignmentCbtfOverrides('asg-200')
      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.created).toBe(0)
      expect(result.changedOrCreated).toBe(0)
      expect(result.errors).toBe(0)
      expect(updateSpy).not.toHaveBeenCalled()
      expect(createSpy).not.toHaveBeenCalled()
    })

    it('updates override in Canvas when times do not match (e.g. from timezone error before fix)', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z') // 3:50 PM EDT
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-202',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        startTime,
        endTime,
        status: 'SCHEDULED',
        canvasOverrideId: '9002',
        user: {
          id: 'user-std-1',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany').mockResolvedValue([mockReservation] as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      // Canvas override has old incorrect time: 15:50 UTC (which was 11:50 AM EDT)
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 9002,
          assignment_id: 789,
          title: 'CBTF Exam Slot',
          student_ids: [5001],
          unlock_at: '2026-09-17T15:50:00.000Z',
          due_at: '2026-09-17T16:40:00.000Z',
          lock_at: '2026-09-17T16:40:00.000Z'
        }
      ])

      const updateSpy = vi.spyOn(canvasModule, 'updateCanvasAssignmentOverride').mockResolvedValue({
        id: 9002,
        assignment_id: 789,
        title: 'CBTF Exam Slot',
        student_ids: [5001],
        unlock_at: '2026-09-17T19:50:00.000Z',
        due_at: '2026-09-17T20:40:00.000Z',
        lock_at: '2026-09-17T20:40:00.000Z'
      })
      vi.spyOn(prisma.assignmentOverride, 'upsert').mockResolvedValue({ id: 'local-ov-2' } as any)
      vi.spyOn(prisma.assignmentOverrideStudent, 'upsert').mockResolvedValue({} as any)
      vi.spyOn(prisma.cbtfReservation, 'update').mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')
      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(0)
      expect(result.updated).toBe(1)
      expect(result.created).toBe(0)
      expect(result.changedOrCreated).toBe(1)
      expect(result.errors).toBe(0)

      expect(updateSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '321',
        '789',
        9002,
        {
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        },
        'teacher-key'
      )
    })

    it('creates a new Canvas override when no override exists in Canvas for a reservation', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-203',
        assignmentId: 'asg-200',
        userId: 'user-std-2',
        startTime,
        endTime,
        status: 'SCHEDULED',
        canvasOverrideId: null,
        user: {
          id: 'user-std-2',
          firstName: 'Carol',
          lastName: 'Danvers',
          email: 'carol@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5002' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany').mockResolvedValue([mockReservation] as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([])

      const createSpy = vi.spyOn(canvasModule, 'createCanvasAssignmentOverride').mockResolvedValue({
        id: 9003,
        assignment_id: 789,
        title: 'CBTF Exam Slot',
        student_ids: [5002],
        unlock_at: '2026-09-17T19:50:00.000Z',
        due_at: '2026-09-17T20:40:00.000Z',
        lock_at: '2026-09-17T20:40:00.000Z'
      })
      vi.spyOn(prisma.cbtfReservation, 'update').mockResolvedValue({} as any)
      vi.spyOn(prisma.assignmentOverride, 'upsert').mockResolvedValue({ id: 'local-ov-3' } as any)
      vi.spyOn(prisma.assignmentOverrideStudent, 'upsert').mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')
      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.created).toBe(1)
      expect(result.changedOrCreated).toBe(1)
      expect(result.errors).toBe(0)

      expect(createSpy).toHaveBeenCalledWith(
        'canvas.vt.edu',
        '321',
        '789',
        {
          student_ids: [5002],
          title: 'CBTF Exam Slot',
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        },
        'teacher-key'
      )
    })

    it('handles Canvas API throttling with retry when fetching or updating overrides', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-204',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        startTime,
        endTime,
        status: 'SCHEDULED',
        canvasOverrideId: '9004',
        user: {
          id: 'user-std-1',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany').mockResolvedValue([mockReservation] as any)
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      // First call throws 429 rate limit, second call succeeds
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides')
        .mockRejectedValueOnce({ statusCode: 429, message: 'Too Many Requests' })
        .mockResolvedValueOnce([
          {
            id: 9004,
            assignment_id: 789,
            title: 'CBTF Exam Slot',
            student_ids: [5001],
            unlock_at: '2026-09-17T19:50:00.000Z',
            due_at: '2026-09-17T20:40:00.000Z',
            lock_at: '2026-09-17T20:40:00.000Z'
          }
        ])

      const result = await resyncAssignmentCbtfOverrides('asg-200')
      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(1)
      expect(result.changedOrCreated).toBe(0)
    })

    it('is idempotent and preserves reservation times when overrides are resynced multiple times', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-idem-1',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        facilityId: 'fac-1',
        seatNumber: 5,
        startTime,
        endTime,
        createdAt: new Date('2026-09-14T20:00:00.000Z'),
        status: 'SCHEDULED',
        canvasOverrideId: '9005',
        facility: {
          id: 'fac-1',
          timezone: 'America/New_York',
          seatAllocationOrder: [5, 12, 20]
        },
        user: {
          id: 'user-std-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany')
        .mockResolvedValueOnce([mockReservation] as any)
        .mockResolvedValueOnce([] as any) // Seat 5 is free
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 9005,
          assignment_id: 789,
          title: 'CBTF Exam Slot',
          student_ids: [5001],
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        }
      ])

      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')

      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.seatsReassigned).toBe(0)
      expect(result.conflicts).toBe(0)

      // Time should NEVER be altered in the database
      expect(updateReservationSpy).not.toHaveBeenCalled()
    })

    it('reassigns seat when original seat is occupied during resync', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-occ-1',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        facilityId: 'fac-1',
        seatNumber: 5,
        startTime,
        endTime,
        createdAt: new Date('2026-09-14T20:00:00.000Z'),
        status: 'SCHEDULED',
        canvasOverrideId: '9006',
        facility: {
          id: 'fac-1',
          timezone: 'America/New_York',
          seatAllocationOrder: [5, 12, 20]
        },
        user: {
          id: 'user-std-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany')
        .mockResolvedValueOnce([mockReservation] as any)
        .mockResolvedValueOnce([{ seatNumber: 5 }] as any) // Seat 5 is occupied by someone else!
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 9006,
          assignment_id: 789,
          title: 'CBTF Exam Slot',
          student_ids: [5001],
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        }
      ])

      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')

      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.seatsReassigned).toBe(1)
      expect(result.conflicts).toBe(0)

      // Reassigned to seat 12 (next in seatAllocationOrder) without touching times
      expect(updateReservationSpy).toHaveBeenCalledWith({
        where: { id: 'res-occ-1' },
        data: {
          seatNumber: 12
        }
      })
    })

    it('marks conflict when facility is at maximum capacity during seat optimization', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-conf-1',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        facilityId: 'fac-1',
        seatNumber: 5,
        startTime,
        endTime,
        createdAt: new Date('2026-09-14T20:00:00.000Z'),
        status: 'SCHEDULED',
        canvasOverrideId: '9007',
        facility: {
          id: 'fac-1',
          timezone: 'America/New_York',
          seatAllocationOrder: [5, 12]
        },
        user: {
          id: 'user-std-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany')
        .mockResolvedValueOnce([mockReservation] as any)
        .mockResolvedValueOnce([{ seatNumber: 5 }, { seatNumber: 12 }] as any) // all seats full!
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([])

      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')

      expect(result.totalChecked).toBe(1)
      expect(result.conflicts).toBe(1)
      expect(result.details[0].status).toBe('conflict')
      expect(updateReservationSpy).not.toHaveBeenCalled()
    })

    it('adjusts seat assignment based on updated facility seating order when no collisions are introduced', async () => {
      const startTime = new Date('2026-09-17T19:50:00.000Z')
      const endTime = new Date('2026-09-17T20:40:00.000Z')
      const mockReservation: any = {
        id: 'res-seat-1',
        assignmentId: 'asg-200',
        userId: 'user-std-1',
        facilityId: 'fac-1',
        seatNumber: 1, // Originally booked seat 1 under old order
        startTime,
        endTime,
        createdAt: new Date('2026-09-15T06:00:00.000Z'),
        status: 'SCHEDULED',
        canvasOverrideId: '9009',
        facility: {
          id: 'fac-1',
          timezone: 'America/New_York',
          seatAllocationOrder: [15, 25, 35, 1] // New order prefers 15, then 25, then 35, then 1
        },
        user: {
          id: 'user-std-1',
          firstName: 'Dave',
          lastName: 'Miller',
          email: 'dave@vt.edu',
          ltiIdentities: [{ platformId: 'plat-200', platformUserId: '5001' }],
          enrollments: [{ courseId: 'course-200' }]
        }
      }

      vi.spyOn(prisma.assignment, 'findUnique').mockResolvedValue(mockAssignment as any)
      vi.spyOn(prisma.cbtfReservation, 'findMany')
        .mockResolvedValueOnce([mockReservation] as any)
        .mockResolvedValueOnce([] as any) // Seat 15 is free in the facility window
      vi.spyOn(prisma.enrollment, 'findFirst').mockResolvedValue({
        user: { ltiIdentities: [{ platformApiKey: 'teacher-key' }] }
      } as any)

      // Canvas already has override matching times (19:50 -> 20:40)
      vi.spyOn(canvasModule, 'fetchCanvasAssignmentOverrides').mockResolvedValue([
        {
          id: 9009,
          assignment_id: 789,
          title: 'CBTF Exam Slot',
          student_ids: [5001],
          unlock_at: '2026-09-17T19:50:00.000Z',
          due_at: '2026-09-17T20:40:00.000Z',
          lock_at: '2026-09-17T20:40:00.000Z'
        }
      ])

      const updateReservationSpy = vi
        .spyOn(prisma.cbtfReservation, 'update')
        .mockResolvedValue({} as any)

      const result = await resyncAssignmentCbtfOverrides('asg-200')

      expect(result.totalChecked).toBe(1)
      expect(result.matched).toBe(1) // Canvas override times already matched
      expect(result.updated).toBe(0)
      expect(result.seatsReassigned).toBe(1)
      expect(result.conflicts).toBe(0)

      // Verify seat reallocated from 1 to 15 based on new facility seatAllocationOrder
      expect(updateReservationSpy).toHaveBeenCalledWith({
        where: { id: 'res-seat-1' },
        data: {
          seatNumber: 15
        }
      })
    })
  })
})
