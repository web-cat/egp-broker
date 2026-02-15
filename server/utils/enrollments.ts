import prisma from '@@/lib/prisma'
import type { Enrollment } from '@prisma/client'
import type { SimpleEnrollment } from '@@/shared/models/enrollment'
import { toSimpleEnrollment } from '@@/shared/models/enrollment'
import type { UserSession } from '#auth-utils'

/**
 * Get the current active enrollment for a user
 * logic:
 * 1. Check DB for currentCourseId
 * 2. If valid, return that enrollment
 * 3. Fallback: Check LTI session for deployment+context
 * 4. Return matching enrollment or null
 */
export async function getCurrentEnrollment(
  userId: string,
  currentCourseId?: string | null,
  lti?: UserSession['lti']
): Promise<SimpleEnrollment | null> {
  let enrollment: Enrollment | null = null

  // 1. Try DB context first
  if (currentCourseId) {
    enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: currentCourseId
        }
      },
      include: {
        course: true
      }
    })
  }

  // 2. Fallback to LTI session context if no DB context found (or invalid)
  if (!enrollment && lti?.context?.id && lti?.deploymentId) {
    // Find course in this deployment
    const course = await prisma.course.findUnique({
      where: {
        deploymentId_ltiContextId: {
          deploymentId: lti.deploymentId,
          ltiContextId: lti.context.id
        }
      }
    })

    if (course) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: course.id
          }
        },
        include: {
          course: true
        }
      })
    }
  }

  if (!enrollment) {
    return null
  }

  return toSimpleEnrollment(enrollment)
}

/**
 * Get all available enrollments for a user
 */
export async function getUserEnrollments(userId: string): Promise<SimpleEnrollment[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId,
      course: {
        OR: [{ workflowState: 'available' }, { workflowState: 'active' }, { workflowState: null }]
      }
    },
    include: {
      course: true
    }
  })

  return enrollments.map((e: Enrollment) => toSimpleEnrollment(e))
}
