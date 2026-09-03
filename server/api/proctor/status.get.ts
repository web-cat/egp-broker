import { defineEventHandler, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ isOnDuty: boolean }>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return {
    statusCode: 200,
    data: {
      isOnDuty: Boolean((session.user as any).isOnDuty)
    }
  }
})
