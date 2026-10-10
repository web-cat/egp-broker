import { defineEventHandler, readValidatedBody, createError } from 'h3'
import { proctorStatusInputSchema } from '@@/shared/schemas/cbtf.schema'
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

  const { isOnDuty } = await readValidatedBody(event, proctorStatusInputSchema.parse)

  await setUserSession(event, {
    ...session,
    user: {
      ...session.user,
      isOnDuty
    }
  })

  return {
    statusCode: 200,
    data: {
      isOnDuty
    }
  }
})
