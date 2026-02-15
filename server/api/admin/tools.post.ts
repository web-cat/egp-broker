import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { createToolSchema } from '@@/shared/models/tool'
import { createTool } from '@@/server/utils/lti-tools'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createToolSchema.parse)
  const tool = await createTool(body)

  return {
    statusCode: 201,
    data: tool
  }
})
