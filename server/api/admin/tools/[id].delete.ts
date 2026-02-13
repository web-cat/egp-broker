import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<null>> => {
  const session = await getUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  await prisma.ltiTool.delete({
    where: { id }
  })

  return {
    statusCode: 200,
    data: null
  }
})
