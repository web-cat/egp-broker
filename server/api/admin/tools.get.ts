import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { adminToolQuerySchema } from '@@/shared/models/tool'
import { getAllTools } from '@@/server/utils/lti-tools'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = await getValidatedQuery(event, adminToolQuerySchema.parse)
  const tools = await getAllTools(query)

  return {
    statusCode: 200,
    data: tools
  }
})
