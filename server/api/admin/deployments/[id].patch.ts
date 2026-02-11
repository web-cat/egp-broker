import { defineEventHandler, getRouterParam } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { updateDeploymentSchema } from '@@/shared/models/deployment'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing deployment ID'
    })
  }

  const body = await readValidatedBody(event, updateDeploymentSchema.parse)

  const deployment = await prisma.ltiDeployment.update({
    where: { id },
    data: body
  })

  return {
    statusCode: 200,
    data: deployment
  }
})
