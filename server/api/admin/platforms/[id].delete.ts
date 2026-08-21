import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'

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

  try {
    await prisma.ltiPlatform.delete({
      where: { id }
    })

    return { status: 'deleted' }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete platform: ${error.message}`
    })
  }
})
