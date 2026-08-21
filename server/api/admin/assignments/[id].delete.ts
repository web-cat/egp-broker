import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/lib/prisma'
import { deleteAssignment } from '@@/server/utils/assignments'

export default defineEventHandler(async (event) => {
  // 1. Require Admin session
  const session = await getUserSession(event)
  if (session.user?.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment ID is required'
    })
  }

  try {
    // Check if assignment exists
    const assignment = await prisma.assignment.findUnique({
      where: { id }
    })

    if (!assignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Assignment not found'
      })
    }

    await deleteAssignment(id)

    return { status: 'deleted' }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete assignment: ${error.message}`
    })
  }
})
