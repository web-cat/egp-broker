import { defineEventHandler, getRouterParam, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import { deleteTool } from '@@/server/utils/lti-tools'

export default defineEventHandler(async (event): Promise<ApiResponse<null>> => {
  const session = await getUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tool ID is required'
    })
  }

  await deleteTool(id)

  return {
    statusCode: 200,
    data: null
  }
})
