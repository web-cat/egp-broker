import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { getPrimaryCbtfFacility } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const facility = await getPrimaryCbtfFacility(prisma as any)

  return {
    statusCode: 200,
    data: facility
  }
})
