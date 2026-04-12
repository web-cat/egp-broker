import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      tool: true // This is critical! It pulls the LtiTool record linked via toolId
    }
  })

  if (!assignment) {
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  }

  return assignment
})