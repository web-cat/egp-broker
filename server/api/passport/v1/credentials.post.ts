import { defineEventHandler, getValidatedQuery, readValidatedBody } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import {
  passPortCredentialsQuerySchema,
  passPortPhase2CredentialsSchema
} from '@@/shared/models/passport'
import { handlePassPortCredentialsDelivery } from '@@/server/utils/passport'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow>> => {
  const { token } = await getValidatedQuery(event, passPortCredentialsQuerySchema.parse)
  const body = await readValidatedBody(event, passPortPhase2CredentialsSchema.parse)

  const tool = await handlePassPortCredentialsDelivery(token, body)

  return {
    statusCode: 200,
    data: tool
  }
})
