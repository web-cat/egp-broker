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

export const courseRowSchema = z.object({
  id: z.string(),
  ltiContextId: z.string().nullable(),
  label: z.string().nullable(),
  title: z.string().nullable(),
  enrollmentCount: z.number(),
  assignmentCount: z.number(),
  createdAt: z.string()
})

export type CourseRow = z.infer<typeof courseRowSchema>

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

export const adminCourseQuerySchema = z.object({
  d: z.string().optional(), // deploymentId (logical)
  p: z.string().optional() // platformId (PK)
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateCourseData = z.infer<typeof createCourseSchema>
export type UpdateCourseData = z.infer<typeof updateCourseSchema>
export type AdminCourseQuery = z.infer<typeof adminCourseQuerySchema>

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
