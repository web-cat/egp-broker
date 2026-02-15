import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { DeploymentRow } from '@@/shared/models/deployment'
import { adminDeploymentQuerySchema } from '@@/shared/models/deployment'
import { getAllDeployments } from '@@/server/utils/lti-deployments'

export default defineEventHandler(async (event): Promise<ApiResponse<DeploymentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = await getValidatedQuery(event, adminDeploymentQuerySchema.parse)
  const deployments = await getAllDeployments(query)

  return {
    statusCode: 200,
    data: deployments
  }
})
