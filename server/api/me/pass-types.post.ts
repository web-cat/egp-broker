import { defineEventHandler, readValidatedBody } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { createPassTypeSchema } from '@@/shared/models/pass'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentCourseId: true,
      enrollments: {
        where: { role: { in: ['TEACHER', 'ADMIN'] } },
        select: { courseId: true }
      }
    }
  })

  const courseId = user?.currentCourseId
  const isAuthorized =
    user?.enrollments.some((e) => e.courseId === courseId) || session.user.globalRole === 'ADMIN'

  if (!courseId || !isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createPassTypeSchema.parse)

  const passType = await prisma.passType.create({
    data: {
      ...body,
      courseId
    }
  })

  return {
    statusCode: 201,
    data: passType
  }
})
