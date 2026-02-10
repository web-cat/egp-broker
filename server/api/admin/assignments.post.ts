import { defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

const createAssignmentSchema = z.object({
  title: z.string().nullable().optional(),
  canvasAssignmentId: z.string().nullable().optional(),
  courseId: z.string().min(1, 'Course is required'),
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
