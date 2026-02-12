import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimplePassPool } from '@@/shared/models/pass'
import { toSimplePassPool } from '@@/shared/models/pass'

export default defineEventHandler(async (event): Promise<ApiResponse<SimplePassPool[]>> => {
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

  // Fetch pass pools for this user and this course
  const pools = await prisma.studentPassPool.findMany({
    where: {
      userId: session.user.id,
      passType: {
        courseId: courseId
      }
    },
    include: {
      passType: true
    }
  })

  return {
    statusCode: 200,
    data: pools.map(toSimplePassPool)
  }
})
