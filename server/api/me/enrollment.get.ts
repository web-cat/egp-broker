import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { Enrollment, CourseRole } from '@prisma/client'

export interface EnrollmentInfo {
  role: CourseRole | null
  courseTitle: string | null
  globalRole: string
}

export default defineEventHandler(async (event): Promise<ApiResponse<EnrollmentInfo>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  let enrollment: (Enrollment & { course: { title: string | null } }) | null = null

  if (session.lti?.context?.id && session.lti?.deploymentId) {
    // Find course in this deployment
    const course = await prisma.course.findUnique({
      where: {
        deploymentId_ltiContextId: {
          deploymentId: session.lti.deploymentId,
          ltiContextId: session.lti.context.id
        }
      }
    })

    if (course) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id
          }
        },
        include: {
          course: {
            select: { title: true }
          }
        }
      })
    }
  }

  return {
    statusCode: 200,
    data: {
      role: enrollment?.role || null,
      courseTitle: enrollment?.course?.title || null,
      globalRole: user.globalRole
    }
  }
})
