import { z } from 'zod'

/**
 * Schema for a Course Section.
 */
export const courseSectionSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  canvasSectionId: z.string().nullable().optional(),
  name: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export type CourseSectionRow = z.infer<typeof courseSectionSchema>

/**
 * Schema for an Assignment Override.
 */
export const assignmentOverrideSchema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  canvasOverrideId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional(),
  courseSectionId: z.string().nullable().optional(),
  courseSection: courseSectionSchema.nullable().optional(),
  studentUserIds: z.array(z.string()).optional()
})

export type AssignmentOverrideRow = z.infer<typeof assignmentOverrideSchema>

/**
 * Schema for resolved student effective assignment dates.
 */
export const effectiveAssignmentDatesSchema = z.object({
  availableFrom: z.date().nullable(),
  dueDate: z.date().nullable(),
  acceptUntil: z.date().nullable(),
  overrideType: z.enum(['NONE', 'SECTION', 'STUDENT']),
  overrideTitle: z.string().nullable().optional()
})

export type EffectiveAssignmentDates = z.infer<typeof effectiveAssignmentDatesSchema>

/**
 * Detailed projection of an assignment override for display in teacher views.
 */
export const assignmentOverrideDetailsSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  type: z.enum(['SECTION', 'STUDENT']),
  targetName: z.string(),
  availableFrom: z.string().nullable(),
  dueDate: z.string().nullable(),
  acceptUntil: z.string().nullable()
})

export type AssignmentOverrideDetails = z.infer<typeof assignmentOverrideDetailsSchema>
