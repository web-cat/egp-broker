/**
 * Assignment Model
 *
 * This file contains Assignment-related types, interfaces and validation schemas
 */

import { z } from 'zod'

export type { Assignment } from '@prisma/client'

// =============================================================================
// INTERFACES
// =============================================================================

export const assignmentRowSchema = z.object({
  id: z.string(),
  resourceLinkId: z.string().nullable(),
  title: z.string().nullable(),
  canvasAssignmentId: z.string().nullable(),
  courseLabel: z.string().nullable(),
  courseTitle: z.string().nullable(),
  dueDate: z.string().nullable(),
  availableFrom: z.string().nullable(),
  acceptUntil: z.string().nullable(),
  eligibleUntil: z.string().nullable().optional(),
  published: z.boolean().default(true),
  createdAt: z.string(),
  toolId: z.string().nullable().optional(),
  toolName: z.string().nullable().optional(),
  eligiblePassTypeNames: z.array(z.string()).optional(),
  eligiblePassTypes: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        hoursPerPass: z.number().optional(),
        extensionOnly: z.boolean().optional(),
        extendsCutoffOnly: z.boolean().optional(),
        minDaysPastDue: z.number().nullable().optional(),
        maxDaysPastDue: z.number().nullable().optional()
      })
    )
    .optional(),
  eligibilities: z
    .array(
      z.object({
        passTypeId: z.string(),
        passTypeName: z.string(),
        isAutomatic: z.boolean()
      })
    )
    .optional(),
  highlight: z.boolean().optional()
})

export type AssignmentRow = z.infer<typeof assignmentRowSchema>

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const createAssignmentSchema = z.object({
  title: z.string().nullable().optional(),
  canvasAssignmentId: z.string().nullable().optional(),
  courseId: z.string().min(1, 'Course is required'),
  dueDate: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional(),
  published: z.boolean().optional()
})

export const updateAssignmentSchema = z.object({
  title: z.string().nullable().optional(),
  canvasAssignmentId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional(),
  published: z.boolean().optional(),
  manualPassTypeIds: z.array(z.string()).optional()
})

export const linkToolSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required')
})

export const configureAssignmentSchema = z.object({
  toolId: z.string().nullable().optional(),
  gradeTranslationId: z.string().nullable().optional()
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateAssignmentData = z.infer<typeof createAssignmentSchema>
export type UpdateAssignmentData = z.infer<typeof updateAssignmentSchema>
export type LinkToolData = z.infer<typeof linkToolSchema>
export type ConfigureAssignmentData = z.infer<typeof configureAssignmentSchema>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialAssignmentState: Omit<CreateAssignmentData, 'courseId'> = {
  title: '',
  canvasAssignmentId: '',
  dueDate: '',
  availableFrom: '',
  acceptUntil: ''
}
