import { defineEventHandler, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { PlatformRow } from '@@/shared/models/platform'
import { getAllPlatforms } from '@@/server/utils/lti-platforms'

export default defineEventHandler(async (event): Promise<ApiResponse<PlatformRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const data = await getAllPlatforms()

  return {
    statusCode: 200,
    data
  }
})
