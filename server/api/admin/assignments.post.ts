import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { createAssignmentSchema } from '@@/shared/models/assignment'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createAssignmentSchema.parse)

  const assignment = await prisma.assignment.create({
    data: {
      resourceLinkId: `manual-${Date.now()}`,
      title: body.title,
      canvasAssignmentId: body.canvasAssignmentId,
      courseId: body.courseId,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      availableFrom: body.availableFrom ? new Date(body.availableFrom) : null,
      acceptUntil: body.acceptUntil ? new Date(body.acceptUntil) : null
    }
  })

  return {
    statusCode: 201,
    data: assignment
  }
})
