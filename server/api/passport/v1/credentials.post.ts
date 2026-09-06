import { defineEventHandler, getQuery, readBody } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { handlePassPortCredentialsDelivery } from '@@/server/utils/passport'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow>> => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : undefined
  const body = await readBody(event)

  const tool = await handlePassPortCredentialsDelivery(token, body)

  return {
    statusCode: 200,
    data: tool
  }
})
