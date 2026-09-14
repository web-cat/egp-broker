import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const proctors = await prisma.user.findMany({
    where: { globalRole: 'PROCTOR' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      globalRole: true,
      avatarUrl: true
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  })

  return {
    statusCode: 200,
    data: proctors
  }
})
