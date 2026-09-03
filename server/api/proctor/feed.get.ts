import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { getProctorLiveFeed } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const feed = await getProctorLiveFeed(prisma as any)

  return {
    statusCode: 200,
    data: feed
  }
})
