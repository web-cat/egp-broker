import { defineEventHandler, getRouterParam, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { initiatePassPortRegistration } from '@@/server/utils/passport'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow>> => {
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

  const tool = await initiatePassPortRegistration(id, event)

  return {
    statusCode: 200,
    data: tool
  }
})
