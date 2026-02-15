import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { updateToolSchema } from '@@/shared/models/tool'
import { updateTool } from '@@/server/utils/lti-tools'

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

  const body = await readValidatedBody(event, updateToolSchema.parse)
  const tool = await updateTool(id, body)

  return {
    statusCode: 200,
    data: tool
  }
})
