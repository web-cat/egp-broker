import { describe, it, expect } from 'vitest'
import {
  createGtaShiftInputSchema,
  updateGtaShiftInputSchema,
  gtaBatchGenerateShiftsSchema,
  createGtaInterviewReservationInputSchema,
  updateGtaInterviewReservationInputSchema,
  updateCourseInterviewLocationInputSchema
} from '../../../../shared/schemas/gta-interview.schema'

describe('Shared Schema: GTA Interview Schemas', () => {
  describe('createGtaShiftInputSchema', () => {
    it('validates a correct shift input', () => {
      const valid = {
        courseId: 'course-1',
        userId: 'gta-1',
        date: '2026-09-18',
        startTime: '10:00',
        endTime: '12:00'
      }
      const result = createGtaShiftInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects invalid date format', () => {
      const invalid = {
        courseId: 'course-1',
        userId: 'gta-1',
        date: '09/18/2026',
        startTime: '10:00',
        endTime: '12:00'
      }
      const result = createGtaShiftInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects invalid time format', () => {
      const invalid = {
        courseId: 'course-1',
        userId: 'gta-1',
        date: '2026-09-18',
        startTime: '10:00 AM',
        endTime: '12:00 PM'
      }
      const result = createGtaShiftInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects when endTime is not after startTime', () => {
      const invalid = {
        courseId: 'course-1',
        userId: 'gta-1',
        date: '2026-09-18',
        startTime: '14:00',
        endTime: '10:00'
      }
      const result = createGtaShiftInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('updateGtaShiftInputSchema', () => {
    it('validates partial updates', () => {
      const valid = {
        startTime: '11:00',
        endTime: '13:00'
      }
      const result = updateGtaShiftInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects if both times provided and endTime <= startTime', () => {
      const invalid = {
        startTime: '13:00',
        endTime: '11:00'
      }
      const result = updateGtaShiftInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('gtaBatchGenerateShiftsSchema', () => {
    it('validates valid batch shift payload', () => {
      const valid = {
        courseId: 'course-1',
        userId: 'gta-1',
        startDate: '2026-09-16',
        endDate: '2026-12-09',
        shifts: [
          { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
          { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' }
        ]
      }
      const result = gtaBatchGenerateShiftsSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects if endDate is before startDate', () => {
      const invalid = {
        courseId: 'course-1',
        userId: 'gta-1',
        startDate: '2026-12-09',
        endDate: '2026-09-16',
        shifts: [{ dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }]
      }
      const result = gtaBatchGenerateShiftsSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects if shifts array is empty', () => {
      const invalid = {
        courseId: 'course-1',
        userId: 'gta-1',
        startDate: '2026-09-16',
        endDate: '2026-12-09',
        shifts: []
      }
      const result = gtaBatchGenerateShiftsSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('createGtaInterviewReservationInputSchema', () => {
    it('validates ISO datetime startTime', () => {
      const valid = {
        assignmentId: 'assign-1',
        startTime: '2026-09-18T10:00:00.000Z'
      }
      const result = createGtaInterviewReservationInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('accepts optional rescheduleReservationId', () => {
      const valid = {
        assignmentId: 'assign-1',
        startTime: '2026-09-18T10:00:00.000Z',
        rescheduleReservationId: 'res-old-123'
      }
      const result = createGtaInterviewReservationInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rescheduleReservationId).toBe('res-old-123')
      }
    })

    it('rejects non-datetime string', () => {
      const invalid = {
        assignmentId: 'assign-1',
        startTime: '10:00'
      }
      const result = createGtaInterviewReservationInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('updateGtaInterviewReservationInputSchema', () => {
    it('validates status update and notes', () => {
      const valid = {
        status: 'COMPLETED',
        notes: 'Student demonstrated clear understanding of recursive backtracking.'
      }
      const result = updateGtaInterviewReservationInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const invalid = {
        status: 'UNKNOWN_STATUS'
      }
      const result = updateGtaInterviewReservationInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('updateCourseInterviewLocationInputSchema', () => {
    it('validates interviewLocation string', () => {
      const valid = {
        interviewLocation: 'McBryde 106 / Zoom Meeting 123-456'
      }
      const result = updateCourseInterviewLocationInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('allows null to clear location', () => {
      const valid = {
        interviewLocation: null
      }
      const result = updateCourseInterviewLocationInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })
})
