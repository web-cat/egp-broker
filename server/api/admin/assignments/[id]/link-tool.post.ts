import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const assignmentId = getRouterParam(event, 'id')
  const { toolId } = await readBody(event)

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { toolId }
  })

  return { success: true }
})
