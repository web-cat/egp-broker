import { defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

const createCourseSchema = z.object({
  ltiContextId: z.string().nullable().optional(),
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

  const body = await readValidatedBody(event, createCourseSchema.parse)

  const course = await prisma.course.create({
    data: body
  })

  return {
    statusCode: 201,
    data: course
  }
})
