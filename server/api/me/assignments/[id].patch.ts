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
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      availableFrom: body.availableFrom ? new Date(body.availableFrom) : null,
      acceptUntil: body.acceptUntil ? new Date(body.acceptUntil) : null
    }
  })

  // Sync automatic pass eligibility
  if (body.title) {
    await syncAssignmentEligibility(updated.id)
  }

  // Sync manual pass eligibilities if provided
  if (body.manualPassTypeIds) {
    await setManualEligibilities(updated.id, body.manualPassTypeIds)
  }

  return {
    statusCode: 200,
    data: updated
  }
})
