import { defineEventHandler } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Clear lti context from the session
  await setUserSession(event, {
    ...session,
    lti: undefined
  })

  return {
    statusCode: 200,
    data: { success: true }
  }
})
