import { defineEventHandler, getRouterParam } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { updateCourseSchema } from '@@/shared/models/course'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing course ID'
    })
  }

  const body = await readValidatedBody(event, updateCourseSchema.parse)

  const course = await prisma.course.update({
    where: { id },
    data: body
  })

  return {
    statusCode: 200,
    data: course
  }
})
