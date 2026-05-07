import { defineEventHandler, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { CasServerAdminRow } from '@@/shared/schemas/cas.schema'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event): Promise<ApiResponse<CasServerAdminRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const servers = await prisma.casServer.findMany({
    select: {
      id: true,
      name: true,
      baseUrl: true,
      serviceValidateVersion: true,
      createdAt: true,
      _count: {
        select: { identities: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    statusCode: 200,
    data: servers.map((s) => ({
      id: s.id,
      name: s.name,
      baseUrl: s.baseUrl,
      serviceValidateVersion: s.serviceValidateVersion as any,
      identityCount: s._count.identities,
      createdAt: s.createdAt.toISOString()
    }))
  }
})
