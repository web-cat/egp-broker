import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const assignmentId = getRouterParam(event, 'id')
  const body = await readBody(event)
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

  if (!enrollment) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to configure this assignment.'
    })
  }

  // 2. Update the assignment with the chosen tool ID
  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      toolId: body.toolId
      // Note: You can also update title or other metadata here if needed
    }
  })

  return { success: true, assignment: updatedAssignment }
})
