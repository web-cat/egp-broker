import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { linkToolSchema } from '@@/shared/models/assignment'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const assignmentId = getRouterParam(event, 'id')
  if (!assignmentId) {
    throw createError({ statusCode: 400, statusMessage: 'Assignment ID is required' })
  }

  const { toolId } = await readValidatedBody(event, linkToolSchema.parse)

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { toolId }
  })

  return { success: true, data: updated }
})
