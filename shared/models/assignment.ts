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

export interface AssignmentRow {
  id: string
  resourceLinkId: string
  title: string | null
  canvasAssignmentId: string | null
  courseLabel: string | null
  courseTitle: string | null
  dueDate: string | null
  availableFrom: string | null
  acceptUntil: string | null
  createdAt: string
  eligiblePassTypeNames?: string[]
  [key: string]: any
}

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
