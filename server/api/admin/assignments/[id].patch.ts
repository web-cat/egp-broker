import { defineEventHandler, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { updateAssignmentSchema } from '@@/shared/models/assignment'

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
      statusMessage: 'Missing assignment ID'
    })
  }

  const body = await readValidatedBody(event, updateAssignmentSchema.parse)

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      title: body.title,
      canvasAssignmentId: body.canvasAssignmentId,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
      availableFrom: body.availableFrom
        ? new Date(body.availableFrom)
        : body.availableFrom === null
          ? null
          : undefined,
      acceptUntil: body.acceptUntil
        ? new Date(body.acceptUntil)
        : body.acceptUntil === null
          ? null
          : undefined,
      published: body.published !== undefined ? body.published : undefined
    }
  })

  // Sync automatic pass eligibility
  if (body.title) {
    await syncAssignmentEligibility(assignment.id)
  }

  return {
    statusCode: 200,
    data: assignment
  }
})
