import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { CasServerAdminRow } from '@@/shared/schemas/cas.schema'
import { updateCasServerSchema } from '@@/shared/schemas/cas.schema'
import prisma from '@@/server/utils/db'

export default defineEventHandler(async (event): Promise<ApiResponse<CasServerAdminRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server ID' })
  }

  const body = await readValidatedBody(event, updateCasServerSchema.parse)

  // Check unique base URL if changed
  if (body.baseUrl) {
    const existing = await prisma.casServer.findUnique({ where: { baseUrl: body.baseUrl } })
    if (existing && existing.id !== id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A CAS server with this base URL already exists.'
      })
    }
  }

  try {
    const server = await prisma.casServer.update({
      where: { id },
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
      statusCode: 200,
      data: {
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        serviceValidateVersion: server.serviceValidateVersion as any,
        identityCount: server._count.identities,
        createdAt: server.createdAt.toISOString()
      }
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'CAS Server not found' })
    }
    throw error
  }
})
