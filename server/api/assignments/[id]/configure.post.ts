import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { configureAssignmentSchema } from '@@/shared/models/assignment'

export default defineEventHandler(async (event) => {
  const assignmentId = getRouterParam(event, 'id')
  if (!assignmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Assignment ID is required' })
  }

  const body = await readValidatedBody(event, configureAssignmentSchema.parse)
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 1. Check if the user is a teacher/admin for this specific assignment's course
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      course: {
        assignments: {
          some: { id: assignmentId }
        }
      },
      role: { in: ['TEACHER', 'ADMIN', 'DESIGNER', 'TA'] }
    }
  })

  if (!enrollment && session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to configure this assignment.'
    })
  }

  // 2. Update the assignment with the chosen tool ID and translation ID
  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      toolId: body.toolId ?? null,
      gradeTranslationId: body.gradeTranslationId ?? null
    }
  })

  return { success: true, assignment: updatedAssignment }
})
