/**
 * Course Model
 *
 * This file contains Course-related types, interfaces and validation schemas
 */

import { z } from 'zod'

export type { Course } from '@prisma/client'

// =============================================================================
// INTERFACES
// =============================================================================

export interface CourseRow {
  id: string
  ltiContextId: string
  label: string | null
  title: string | null
  enrollmentCount: number
  assignmentCount: number
  createdAt: string
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const createCourseSchema = z.object({
  ltiContextId: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  canvasCourseId: z.string().nullable().optional(),
  workflowState: z.string().nullable().optional()
})

export const updateCourseSchema = z.object({
  label: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  canvasCourseId: z.string().nullable().optional(),
  workflowState: z.string().nullable().optional()
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateCourseData = z.infer<typeof createCourseSchema>
export type UpdateCourseData = z.infer<typeof updateCourseSchema>

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialCourseState: CreateCourseData = {
  ltiContextId: '',
  label: '',
  title: '',
  canvasCourseId: '',
  workflowState: ''
}
