import { defineEventHandler, readValidatedBody } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { updateAssignmentSchema } from '@@/shared/models/assignment'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id }
  })

  if (!assignment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found'
    })
  }

  // Check if user has teacher access to this course
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      enrollments: {
        where: { courseId: assignment.courseId, role: { in: ['TEACHER', 'ADMIN'] } }
      }
    }
  })

  const isAuthorized = (user?.enrollments.length ?? 0) > 0 || session.user.globalRole === 'ADMIN'

  if (!isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, updateAssignmentSchema.parse)

  const updated = await prisma.assignment.update({
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

  // Sync pass eligibilities
  if (body.manualPassTypeIds !== undefined) {
    // Explicit manual selection takes precedence
    await setManualEligibilities(updated.id, body.manualPassTypeIds)
  } else if (body.title) {
    // Fall back to title regex auto-sync only when manual list is not specified
    await syncAssignmentEligibility(updated.id)
  }

  return {
    statusCode: 200,
    data: updated
  }
})
