import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimpleEnrollment, Enrollment } from '@@/shared/models/enrollment'
import { toSimpleEnrollment } from '@@/shared/models/enrollment'

export default defineEventHandler(async (event): Promise<ApiResponse<SimpleEnrollment>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  let enrollment: Enrollment

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
            userId: session.user.id,
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
    return {
      statusCode: 200,
      data: null
    }
  }

  return {
    statusCode: 200,
    data: toSimpleEnrollment(enrollment)
  }
})
