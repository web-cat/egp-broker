import type { H3Event } from 'h3'
import { createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { CourseRole } from '@prisma/client'

export interface CourseAuthContext {
  userId: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    globalRole: string
  }
  courseRole: CourseRole | null
  isInstructor: boolean
  isGta: boolean
}

/**
 * Validates that the caller is logged in and belongs to the specified course.
 * Global ADMINs are granted full access with isInstructor = true.
 */
export async function assertCourseMember(
  event: H3Event,
  courseId: string
): Promise<CourseAuthContext> {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const user = session.user

  if (user.globalRole === 'ADMIN') {
    return {
      userId: user.id,
      user,
      courseRole: 'ADMIN' as CourseRole,
      isInstructor: true,
      isGta: true
    }
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId
      }
    }
  })

  if (!enrollment) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Not enrolled in this course' })
  }

  const isInstructor = enrollment.role === 'TEACHER' || enrollment.role === 'ADMIN'
  const isGta = enrollment.role === 'TA'

  return {
    userId: user.id,
    user,
    courseRole: enrollment.role,
    isInstructor,
    isGta
  }
}

/**
 * Validates that targetUserId has CourseRole.TA in the specified course.
 */
export async function assertUserIsCourseGta(courseId: string, targetUserId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: targetUserId,
        courseId
      }
    }
  })

  if (!enrollment || enrollment.role !== 'TA') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Target user is not enrolled as a Teaching Assistant in this course'
    })
  }
}

/**
 * Enforces permissions for creating/editing GTA shifts:
 * - Course Instructors (and global ADMINs) can manage shifts for any enrolled TA in the course.
 * - GTAs (CourseRole.TA) can manage shifts only for themselves.
 * - If targetGtaUserId is provided, ensures that target user is indeed an enrolled TA in this course.
 */
export async function assertCourseInstructorOrSelfGta(
  event: H3Event,
  courseId: string,
  targetGtaUserId?: string
): Promise<CourseAuthContext> {
  const auth = await assertCourseMember(event, courseId)

  if (auth.isInstructor) {
    if (targetGtaUserId) {
      await assertUserIsCourseGta(courseId, targetGtaUserId)
    }
    return auth
  }

  if (auth.isGta) {
    if (targetGtaUserId && targetGtaUserId !== auth.userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Teaching Assistants can only manage their own shifts'
      })
    }
    return auth
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden: You do not have permission to manage GTA shifts for this course'
  })
}
