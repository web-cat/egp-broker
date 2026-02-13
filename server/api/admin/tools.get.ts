import { defineEventHandler, getQuery } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = getQuery(event)
  const platformFilter = query.p as string | undefined

  const where: Record<string, unknown> = {}
  if (platformFilter) {
    where.platformId = platformFilter
  }

  const tools = await prisma.ltiTool.findMany({
    where,
    include: {
      platform: {
        select: {
          issuer: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    statusCode: 200,
    data: tools.map((t) => ({
      id: t.id,
      name: t.name,
      baseUrl: t.baseUrl,
      protocol: t.protocol,
      platformId: t.platformId,
      platformIssuer: t.platform?.issuer ?? null,
      createdAt: t.createdAt.toISOString()
    }))
  }
})
