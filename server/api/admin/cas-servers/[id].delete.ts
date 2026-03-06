import { defineEventHandler, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event): Promise<ApiResponse<null>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing server ID' })
  }

  // Check if any CasIdentity records are using this server
  const count = await prisma.casIdentity.count({
    where: { casServerId: id }
  })

  if (count > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot delete a CAS Server that has ${count} linked user identities.`
    })
  }

  try {
    await prisma.casServer.delete({
      where: { id }
    })

    return {
      statusCode: 200,
      data: null
    }
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'CAS Server not found' })
    }
    throw error
  }
})
