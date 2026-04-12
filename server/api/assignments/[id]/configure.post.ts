import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const assignmentId = getRouterParam(event, 'id')
  const body = await readBody(event)
  
  // 1. Ensure user is authenticated and is a teacher for this course
  const session = await getUserSession(event)
  if (!session.user) throw createError({ statusCode: 401 })

  // 2. Update the assignment with the chosen tool ID
  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { toolId: body.toolId }
  })

  return { success: true, assignment: updatedAssignment }
})