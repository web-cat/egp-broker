import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { DeploymentRow } from '@@/shared/models/deployment'
import { updateDeploymentSchema } from '@@/shared/models/deployment'
import { updateDeployment } from '@@/server/utils/lti-deployments'

export default defineEventHandler(async (event): Promise<ApiResponse<DeploymentRow>> => {
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
      statusMessage: 'Deployment ID is required'
    })
  }

  const body = await readValidatedBody(event, updateDeploymentSchema.parse)
  const deployment = await updateDeployment(id, body)

  return {
    statusCode: 200,
    data: deployment
  }
})
