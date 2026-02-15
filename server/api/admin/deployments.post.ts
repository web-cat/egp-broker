import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { DeploymentRow } from '@@/shared/models/deployment'
import { createDeploymentSchema } from '@@/shared/models/deployment'
import { createDeployment } from '@@/server/utils/lti-deployments'

export default defineEventHandler(async (event): Promise<ApiResponse<DeploymentRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createDeploymentSchema.parse)
  const deployment = await createDeployment(body)

  return {
    statusCode: 201,
    data: deployment
  }
})
