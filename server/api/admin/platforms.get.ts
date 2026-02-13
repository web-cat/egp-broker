import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

import type { PlatformRow } from '@@/shared/models/platform'

export default defineEventHandler(async (event): Promise<ApiResponse<PlatformRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const platforms = await prisma.ltiPlatform.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { deployments: true }
      }
    }
  })

  const data: PlatformRow[] = platforms.map((p) => ({
    id: p.id,
    issuer: p.issuer,
    clientId: p.clientId,
    name: p.name,
    deploymentCount: p._count.deployments,
    createdAt: p.createdAt.toISOString()
  }))

  return {
    statusCode: 200,
    data
  }
})
