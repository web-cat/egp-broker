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
  createdAt: z.string(),
  eligiblePassTypeNames: z.array(z.string()).optional(),
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
  acceptUntil: z.string().nullable().optional()
})

export const updateAssignmentSchema = z.object({
  title: z.string().nullable().optional(),
  canvasAssignmentId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional()
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateAssignmentData = z.infer<typeof createAssignmentSchema>
export type UpdateAssignmentData = z.infer<typeof updateAssignmentSchema>

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
