import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<null>> => {
  const session = await getUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const passType = await prisma.passType.findUnique({
    where: { id }
  })

  if (!passType) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pass Type not found'
    })
  }

  // Check if user has teacher access to this course
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      enrollments: {
        where: { courseId: passType.courseId, role: { in: ['TEACHER', 'ADMIN'] } }
      }
    }
  })

  const isAuthorized = user?.enrollments.length! > 0 || session.user.globalRole === 'ADMIN'

  if (!isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  await prisma.passType.delete({
    where: { id }
  })

  return {
    statusCode: 200,
    data: null
  }
})
