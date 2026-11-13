import { z } from 'zod'

/**
 * Projected output DTO for an individual StudentAssignmentNotice
 */
export const studentAssignmentNoticeDtoSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  studentId: z.string(),
  notice: z.string(),
  authorId: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type StudentAssignmentNoticeDto = z.infer<typeof studentAssignmentNoticeDtoSchema>

/**
 * Individual item inside a batch upload payload
 */
export const batchUpsertNoticeItemSchema = z.object({
  studentIdentifier: z
    .string()
    .trim()
    .min(1, 'Student identifier (email or student ID) is required'),
  notice: z.string().trim().min(1, 'Notice content is required')
})

export type BatchUpsertNoticeItem = z.infer<typeof batchUpsertNoticeItemSchema>

/**
 * Payload for batch uploading staff notices for an assignment
 */
export const batchUpsertStudentAssignmentNoticesSchema = z
  .object({
    notices: z
      .array(batchUpsertNoticeItemSchema)
      .max(1000, 'Cannot exceed 1,000 notices per batch')
      .optional(),
    items: z
      .array(batchUpsertNoticeItemSchema)
      .max(1000, 'Cannot exceed 1,000 notices per batch')
      .optional()
  })
  .refine(
    (data) => (data.notices && data.notices.length > 0) || (data.items && data.items.length > 0),
    {
      message: 'At least one notice is required'
    }
  )
  .transform((data) => ({
    notices: (data.notices || data.items || []) as BatchUpsertNoticeItem[]
  }))

export type BatchUpsertStudentAssignmentNoticesInput = z.infer<
  typeof batchUpsertStudentAssignmentNoticesSchema
>

/**
 * Payload for creating or updating a single student notice
 */
export const singleUpsertStudentAssignmentNoticeSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required').optional(),
  notice: z.string().trim().min(1, 'Notice content is required')
})

export type SingleUpsertStudentAssignmentNoticeInput = z.infer<
  typeof singleUpsertStudentAssignmentNoticeSchema
>

/**
 * Result DTO for batch upsert operations
 */
export const batchUpsertNoticesResultSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  unmatchedIdentifiers: z.array(z.string()),
  totalProcessed: z.number().int().nonnegative()
})

export type BatchUpsertNoticesResult = z.infer<typeof batchUpsertNoticesResultSchema>
