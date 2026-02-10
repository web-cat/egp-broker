import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

const updateAssignmentSchema = z.object({
  title: z.string().nullable().optional(),
  canvasAssignmentId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  availableFrom: z.string().nullable().optional(),
  acceptUntil: z.string().nullable().optional()
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
          : undefined
    }
  })

  return {
    statusCode: 200,
    data: assignment
  }
})
