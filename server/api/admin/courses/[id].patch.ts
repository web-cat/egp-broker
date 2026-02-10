import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

const updateCourseSchema = z.object({
  label: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  canvasCourseId: z.string().nullable().optional(),
  workflowState: z.string().nullable().optional()
})

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
