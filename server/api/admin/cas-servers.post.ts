import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { CasServerAdminRow } from '@@/shared/schemas/cas.schema'
import { createCasServerSchema } from '@@/shared/schemas/cas.schema'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event): Promise<ApiResponse<CasServerAdminRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readValidatedBody(event, createCasServerSchema.parse)

  // Check unique base URL
  const existing = await prisma.casServer.findUnique({ where: { baseUrl: body.baseUrl } })
  if (existing) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A CAS server with this base URL already exists.'
    })
  }

  const server = await prisma.casServer.create({
    data: body,
    select: {
      id: true,
      name: true,
      baseUrl: true,
      serviceValidateVersion: true,
      createdAt: true,
      _count: {
        select: { identities: true }
      }
    }
  })

  return {
    statusCode: 201,
    data: {
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      serviceValidateVersion: server.serviceValidateVersion as any,
      identityCount: server._count.identities,
      createdAt: server.createdAt.toISOString()
    }
  }
})
