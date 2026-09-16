/**
 * Enrollment Model
 *
 * This file contains Enrollment-related types, interfaces and validation schemas
 */

// =============================================================================
// DATABASE ENTITY
// =============================================================================

/**
 * Enrollment entity - re-exported from Prisma
 */
import type { Enrollment, CourseRole, Course } from '@prisma/client'
export type { Enrollment } from '@prisma/client'

/**
 * Simplified enrollment for context and listing
 */
export interface SimpleEnrollment {
  id: string
  courseId: string
  courseTitle: string | null
  courseLabel: string | null
  role: CourseRole
  interviewLocation?: string | null
}

/**
 * Helper function to convert Prisma Enrollment to SimpleEnrollment
 */
export function toSimpleEnrollment(
  enrollment: Enrollment & { course?: Course | null }
): SimpleEnrollment {
  return {
    id: enrollment.id,
    courseId: enrollment.courseId,
    courseTitle: enrollment.course?.title ?? null,
    courseLabel: enrollment.course?.label ?? null,
    role: enrollment.role,
    interviewLocation: enrollment.course?.interviewLocation ?? null
  }
}
