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
  cbtfReservationRowSchema,
  createReservationNoteInputSchema,
  searchUserByEmailSchema,
  grantProctorRoleInputSchema,
  cbtfBatchGenerateShiftsSchema,
  cbtfUpdateProctorShiftInputSchema,
  cbtfReservationStatusEnum
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

    it('validates reservation row with CHECKED_OUT status', () => {
      const row = {
        id: 'res-2',
        facilityId: 'fac-1',
        assignmentId: 'asg-1',
        assignmentTitle: 'Midterm 1',
        userId: 'usr-2',
        studentName: 'Checked Out Student',
        studentId: '906000002',
        studentAvatarUrl: null,
        seatNumber: 14,
        startTime: '2026-09-15T09:00:00.000Z',
        endTime: '2026-09-15T10:00:00.000Z',
        status: 'CHECKED_OUT' as const,
        checkedInAt: '2026-09-15T08:58:00.000Z',
        checkedOutAt: '2026-09-15T09:55:00.000Z',
        checkedInByUserId: 'usr-p1',
        checkedOutByUserId: 'usr-p1'
      }
      expect(cbtfReservationRowSchema.safeParse(row).success).toBe(true)
    })
  })

  describe('cbtfReservationStatusEnum', () => {
    it('accepts all expected statuses including CHECKED_OUT', () => {
      const statuses = [
        'SCHEDULED',
        'CHECKED_IN',
        'CHECKED_OUT',
        'COMPLETED',
        'MISSED',
        'CANCELLED'
      ]
      for (const s of statuses) {
        expect(cbtfReservationStatusEnum.safeParse(s).success).toBe(true)
      }
    })

    it('rejects invalid status', () => {
      expect(cbtfReservationStatusEnum.safeParse('UNKNOWN_STATUS').success).toBe(false)
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

  describe('createReservationNoteInputSchema', () => {
    it('validates a note with reservationId', () => {
      const valid = {
        reservationId: 'res-123',
        content: 'Student arrived with unapproved notes',
        hasPhotos: true
      }
      const result = createReservationNoteInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasPhotos).toBe(true)
      }
    })

    it('validates a note with seatNumber', () => {
      const valid = {
        seatNumber: 12,
        content: 'Glancing at neighboring screen',
        hasPhotos: false
      }
      const result = createReservationNoteInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('defaults hasPhotos to false when omitted', () => {
      const valid = {
        reservationId: 'res-456',
        content: 'Spilled water on desk, cleaned up'
      }
      const result = createReservationNoteInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasPhotos).toBe(false)
      }
    })

    it('rejects when neither reservationId nor seatNumber is provided', () => {
      const invalid = {
        content: 'Missing target'
      }
      const result = createReservationNoteInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects empty content', () => {
      const invalid = {
        reservationId: 'res-123',
        content: '   '
      }
      const result = createReservationNoteInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('searchUserByEmailSchema', () => {
    it('validates a valid email address and normalizes it', () => {
      const valid = { email: ' PROCTOR@EXAMPLE.COM ' }
      const result = searchUserByEmailSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('proctor@example.com')
      }
    })

    it('rejects invalid email addresses', () => {
      expect(searchUserByEmailSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
      expect(searchUserByEmailSchema.safeParse({ email: '' }).success).toBe(false)
    })
  })

  describe('grantProctorRoleInputSchema', () => {
    it('validates valid userId', () => {
      const valid = { userId: 'clh123456789' }
      expect(grantProctorRoleInputSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects empty userId', () => {
      expect(grantProctorRoleInputSchema.safeParse({ userId: '' }).success).toBe(false)
    })
  })

  describe('cbtfBatchGenerateShiftsSchema', () => {
    it('validates a valid batch shift generation input', () => {
      const valid = {
        facilityId: 'fac-1',
        userId: 'usr-p1',
        startDate: '2026-09-15',
        endDate: '2026-12-11',
        shifts: [
          { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '11:30' }
        ]
      }
      expect(cbtfBatchGenerateShiftsSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects endDate earlier than startDate', () => {
      const invalid = {
        facilityId: 'fac-1',
        userId: 'usr-p1',
        startDate: '2026-10-15',
        endDate: '2026-09-15',
        shifts: [{ dayOfWeek: 1, startTime: '14:00', endTime: '17:00' }]
      }
      expect(cbtfBatchGenerateShiftsSchema.safeParse(invalid).success).toBe(false)
    })

    it('rejects empty shift list or invalid shift times', () => {
      expect(
        cbtfBatchGenerateShiftsSchema.safeParse({
          facilityId: 'fac-1',
          userId: 'usr-p1',
          startDate: '2026-09-15',
          endDate: '2026-12-11',
          shifts: []
        }).success
      ).toBe(false)

      expect(
        cbtfBatchGenerateShiftsSchema.safeParse({
          facilityId: 'fac-1',
          userId: 'usr-p1',
          startDate: '2026-09-15',
          endDate: '2026-12-11',
          shifts: [{ dayOfWeek: 1, startTime: '17:00', endTime: '14:00' }]
        }).success
      ).toBe(false)
    })
  })

  describe('cbtfUpdateProctorShiftInputSchema', () => {
    it('validates valid shift update input', () => {
      const valid = {
        userId: 'usr-p2',
        startTime: '2026-09-15T14:00:00.000Z',
        endTime: '2026-09-15T17:00:00.000Z'
      }
      expect(cbtfUpdateProctorShiftInputSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects endTime before or equal to startTime', () => {
      const invalid = {
        startTime: '2026-09-15T17:00:00.000Z',
        endTime: '2026-09-15T14:00:00.000Z'
      }
      expect(cbtfUpdateProctorShiftInputSchema.safeParse(invalid).success).toBe(false)
    })
  })
})
