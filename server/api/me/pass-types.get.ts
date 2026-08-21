import { defineEventHandler } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  let courseId = user?.currentCourseId

  // Fallback to LTI session context
  if (!courseId && session.lti?.context?.id && session.lti?.deploymentId) {
    const course = await prisma.course.findUnique({
      where: {
        deploymentId_ltiContextId: {
          deploymentId: session.lti.deploymentId,
          ltiContextId: session.lti.context.id
        }
      },
      select: { id: true }
    })
    courseId = course?.id
  }

  if (!courseId) {
    return {
      statusCode: 200,
      data: []
    }
  }

  // Fetch pass types for this course
  const passTypes = await prisma.passType.findMany({
    where: {
      courseId: courseId
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  return {
    statusCode: 200,
    data: passTypes
  }
})
