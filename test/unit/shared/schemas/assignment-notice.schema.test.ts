import { describe, it, expect } from 'vitest'
import {
  studentAssignmentNoticeDtoSchema,
  batchUpsertNoticeItemSchema,
  batchUpsertStudentAssignmentNoticesSchema,
  singleUpsertStudentAssignmentNoticeSchema,
  batchUpsertNoticesResultSchema
} from '../../../../shared/schemas/assignment-notice.schema'

describe('StudentAssignmentNotice Schemas', () => {
  describe('studentAssignmentNoticeDtoSchema', () => {
    it('validates a complete notice DTO', () => {
      const valid = {
        id: 'notice-1',
        assignmentId: 'asg-1',
        studentId: 'user-1',
        notice: 'Check recursion limit test case (#4)',
        authorId: 'ta-1',
        authorName: 'Jane Doe',
        createdAt: '2026-11-12T12:00:00.000Z',
        updatedAt: '2026-11-12T12:30:00.000Z'
      }
      const parsed = studentAssignmentNoticeDtoSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('validates notice DTO with optional/nullable author fields omitted or null', () => {
      const valid = {
        id: 'notice-2',
        assignmentId: 'asg-1',
        studentId: 'user-2',
        notice: 'Flagged by MOSS 85% overlap with template',
        authorId: null,
        authorName: null,
        createdAt: '2026-11-12T12:00:00.000Z',
        updatedAt: '2026-11-12T12:00:00.000Z'
      }
      const parsed = studentAssignmentNoticeDtoSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const invalid = {
        id: 'notice-3',
        assignmentId: 'asg-1'
        // missing studentId, notice, createdAt, updatedAt
      }
      const parsed = studentAssignmentNoticeDtoSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })

  describe('batchUpsertNoticeItemSchema', () => {
    it('validates a valid notice item with student email', () => {
      const valid = {
        studentIdentifier: 'student@vt.edu',
        notice: 'Special accommodations: 15-min interview'
      }
      const parsed = batchUpsertNoticeItemSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('validates a valid notice item with student ID', () => {
      const valid = {
        studentIdentifier: '906123456',
        notice: 'Reviewed PR #12: verify heap allocation logic'
      }
      const parsed = batchUpsertNoticeItemSchema.safeParse(valid)
      expect(parsed.success).toBe(true)
    })

    it('rejects blank studentIdentifier or notice', () => {
      expect(
        batchUpsertNoticeItemSchema.safeParse({ studentIdentifier: '', notice: 'hello' }).success
      ).toBe(false)
      expect(
        batchUpsertNoticeItemSchema.safeParse({ studentIdentifier: '   ', notice: 'hello' }).success
      ).toBe(false)
      expect(
        batchUpsertNoticeItemSchema.safeParse({ studentIdentifier: 'student@vt.edu', notice: '' })
          .success
      ).toBe(false)
      expect(
        batchUpsertNoticeItemSchema.safeParse({
          studentIdentifier: 'student@vt.edu',
          notice: '   '
        }).success
      ).toBe(false)
    })
  })

  describe('batchUpsertStudentAssignmentNoticesSchema', () => {
    it('validates an array of notice items', () => {
      const payload = {
        notices: [
          { studentIdentifier: 'alice@vt.edu', notice: 'Check dynamic array sizing' },
          { studentIdentifier: 'bob@vt.edu', notice: 'Memory leak in destructor' }
        ]
      }
      const parsed = batchUpsertStudentAssignmentNoticesSchema.safeParse(payload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.notices).toHaveLength(2)
      }
    })

    it('rejects empty notices array', () => {
      const empty = { notices: [] }
      const parsed = batchUpsertStudentAssignmentNoticesSchema.safeParse(empty)
      expect(parsed.success).toBe(false)
    })

    it('rejects payload exceeding 1000 items', () => {
      const oversize = {
        notices: Array.from({ length: 1001 }, (_, i) => ({
          studentIdentifier: `student${i}@vt.edu`,
          notice: 'Note'
        }))
      }
      const parsed = batchUpsertStudentAssignmentNoticesSchema.safeParse(oversize)
      expect(parsed.success).toBe(false)
    })
  })

  describe('singleUpsertStudentAssignmentNoticeSchema', () => {
    it('validates valid single notice input with studentId', () => {
      const parsed = singleUpsertStudentAssignmentNoticeSchema.safeParse({
        studentId: 'user-1',
        notice: 'Please test with null input'
      })
      expect(parsed.success).toBe(true)
    })

    it('validates valid single notice input without studentId when studentId is supplied via URL route', () => {
      const parsed = singleUpsertStudentAssignmentNoticeSchema.safeParse({
        notice: 'Please test with null input'
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects empty notice string', () => {
      const parsed = singleUpsertStudentAssignmentNoticeSchema.safeParse({
        notice: '   '
      })
      expect(parsed.success).toBe(false)
    })
  })

  describe('batchUpsertNoticesResultSchema', () => {
    it('validates a complete batch upload result', () => {
      const result = {
        createdCount: 15,
        updatedCount: 3,
        unmatchedIdentifiers: ['unknown@vt.edu'],
        totalProcessed: 18
      }
      const parsed = batchUpsertNoticesResultSchema.safeParse(result)
      expect(parsed.success).toBe(true)
    })

    it('rejects negative counts', () => {
      const result = {
        createdCount: -1,
        updatedCount: 0,
        unmatchedIdentifiers: [],
        totalProcessed: 0
      }
      const parsed = batchUpsertNoticesResultSchema.safeParse(result)
      expect(parsed.success).toBe(false)
    })
  })
})
