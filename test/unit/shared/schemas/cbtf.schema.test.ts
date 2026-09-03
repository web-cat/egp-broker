import { describe, it, expect } from 'vitest'
import {
  cbtfFacilityConfigSchema,
  cbtfOperatingHoursInputSchema,
  cbtfScheduleExceptionInputSchema,
  cbtfProctorShiftInputSchema,
  createReservationInputSchema,
  rescheduleReservationInputSchema,
  proctorCheckInInputSchema,
  proctorCheckOutInputSchema,
  cbtfAvailabilityQuerySchema,
  cbtfReservationRowSchema
} from '../../../../shared/schemas/cbtf.schema'
import { userRowSchema } from '../../../../shared/models/user'
import {
  assignmentRowSchema,
  createAssignmentSchema,
  updateAssignmentSchema
} from '../../../../shared/models/assignment'

describe('CBTF Shared Schemas', () => {
  describe('cbtfFacilityConfigSchema', () => {
    it('validates a valid facility configuration', () => {
      const valid = {
        name: 'Main CBTF Facility',
        totalSeats: 48,
        seatAllocationOrder: [1, 15, 29, 2, 16, 30]
      }
      const result = cbtfFacilityConfigSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects invalid facility configuration', () => {
      const invalid = {
        name: '',
        totalSeats: 0,
        seatAllocationOrder: []
      }
      const result = cbtfFacilityConfigSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('cbtfOperatingHoursInputSchema', () => {
    it('validates valid operating hours', () => {
      const valid = {
        dayOfWeek: 1,
        openTime: '08:00',
        closeTime: '17:00'
      }
      const result = cbtfOperatingHoursInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects closeTime earlier than or equal to openTime', () => {
      const invalid = {
        dayOfWeek: 1,
        openTime: '18:00',
        closeTime: '08:00'
      }
      const result = cbtfOperatingHoursInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('closeTime must be after openTime')
      }
    })

    it('rejects invalid dayOfWeek', () => {
      const invalid = {
        dayOfWeek: 7, // must be 0-6
        openTime: '08:00',
        closeTime: '17:00'
      }
      const result = cbtfOperatingHoursInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects invalid time formats', () => {
      const invalid = {
        dayOfWeek: 2,
        openTime: '8am',
        closeTime: '25:00'
      }
      const result = cbtfOperatingHoursInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('cbtfScheduleExceptionInputSchema', () => {
    it('validates full-day closure exception', () => {
      const valid = {
        date: '2026-11-26T00:00:00.000Z',
        isClosed: true,
        reason: 'Thanksgiving Holiday'
      }
      const result = cbtfScheduleExceptionInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('validates adjusted hours exception', () => {
      const valid = {
        date: '2026-11-25T00:00:00.000Z',
        isClosed: false,
        openTime: '08:00',
        closeTime: '12:00',
        reason: 'Day before holiday early close'
      }
      const result = cbtfScheduleExceptionInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('cbtfProctorShiftInputSchema', () => {
    it('validates valid proctor shift', () => {
      const valid = {
        userId: 'clh1234567890123456789012',
        date: '2026-09-10T00:00:00.000Z',
        startTime: '08:00',
        endTime: '12:00'
      }
      const result = cbtfProctorShiftInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects shift where endTime <= startTime', () => {
      const invalid = {
        userId: 'clh1234567890123456789012',
        date: '2026-09-10T00:00:00.000Z',
        startTime: '14:00',
        endTime: '10:00'
      }
      const result = cbtfProctorShiftInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('createReservationInputSchema and rescheduleReservationInputSchema', () => {
    it('validates reservation request inputs', () => {
      const createInput = {
        assignmentId: 'clh1234567890123456789012',
        startTime: '2026-09-10T09:15:00.000Z'
      }
      const rescheduleInput = {
        startTime: '2026-09-10T14:30:00.000Z'
      }
      expect(createReservationInputSchema.safeParse(createInput).success).toBe(true)
      expect(rescheduleReservationInputSchema.safeParse(rescheduleInput).success).toBe(true)
    })
  })

  describe('proctorCheckInInputSchema and proctorCheckOutInputSchema', () => {
    it('validates student ID string input', () => {
      expect(proctorCheckInInputSchema.safeParse({ studentId: '906000001' }).success).toBe(true)
      expect(proctorCheckInInputSchema.safeParse({ studentId: '   ' }).success).toBe(false)
      expect(proctorCheckOutInputSchema.safeParse({ studentId: '906000001' }).success).toBe(true)
    })
  })

  describe('cbtfAvailabilityQuerySchema', () => {
    it('validates availability query params', () => {
      const validQuery = {
        assignmentId: 'clh1234567890123456789012',
        timeOfDayPreference: 'morning' as const,
        selectedDate: '2026-09-15'
      }
      expect(cbtfAvailabilityQuerySchema.safeParse(validQuery).success).toBe(true)
    })

    it('rejects malformed selectedDate', () => {
      const invalidQuery = {
        assignmentId: 'clh1234567890123456789012',
        selectedDate: '09-15-2026'
      }
      expect(cbtfAvailabilityQuerySchema.safeParse(invalidQuery).success).toBe(false)
    })
  })

  describe('cbtfReservationRowSchema', () => {
    it('validates reservation row projection', () => {
      const row = {
        id: 'res-1',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        assignmentTitle: 'Midterm 1',
        userId: 'usr-1',
        studentName: 'Demo User',
        studentId: '906000001',
        studentAvatarUrl: null,
        seatNumber: 12,
        startTime: '2026-09-15T10:00:00.000Z',
        endTime: '2026-09-15T11:00:00.000Z',
        status: 'SCHEDULED' as const,
        checkedInAt: null,
        checkedOutAt: null,
        checkedInByUserId: null,
        checkedOutByUserId: null
      }
      expect(cbtfReservationRowSchema.safeParse(row).success).toBe(true)
    })
  })

  describe('User and Assignment schemas integration', () => {
    it('accepts PROCTOR in userRowSchema and optional studentId', () => {
      const proctorUser = {
        id: 'usr-p1',
        email: 'proctor@example.com',
        studentId: null,
        firstName: 'Pat',
        lastName: 'Proctor',
        globalRole: 'PROCTOR' as const,
        avatarUrl: null,
        createdAt: '2026-09-02T21:00:00.000Z',
        emailVerified: true
      }
      expect(userRowSchema.safeParse(proctorUser).success).toBe(true)
    })

    it('accepts schedulable assignment attributes in assignmentRowSchema and mutation schemas', () => {
      const schedulableRow = {
        id: 'asg-sched',
        resourceLinkId: 'rl-sched',
        title: 'Midterm Exam',
        canvasAssignmentId: '555',
        courseLabel: 'CS 101',
        courseTitle: 'Intro to CS',
        dueDate: '2026-09-20T23:59:00.000Z',
        availableFrom: '2026-09-01T00:00:00.000Z',
        acceptUntil: '2026-09-20T23:59:00.000Z',
        published: true,
        isSchedulable: true,
        scheduleWindowStart: '2026-09-10T08:00:00.000Z',
        scheduleWindowEnd: '2026-09-20T18:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z'
      }
      expect(assignmentRowSchema.safeParse(schedulableRow).success).toBe(true)

      const createData = {
        courseId: 'course-1',
        title: 'CBTF Exam',
        isSchedulable: true,
        scheduleWindowStart: '2026-09-10T08:00:00.000Z',
        scheduleWindowEnd: '2026-09-20T18:00:00.000Z'
      }
      expect(createAssignmentSchema.safeParse(createData).success).toBe(true)

      const updateData = {
        isSchedulable: false
      }
      expect(updateAssignmentSchema.safeParse(updateData).success).toBe(true)
    })
  })
})
