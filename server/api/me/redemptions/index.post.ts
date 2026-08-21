import { defineEventHandler, createError, readValidatedBody } from 'h3'
import { redeemPassSchema } from '@@/shared/models/redemption'
import { redeemPass } from '@@/server/utils/redemptions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const { assignmentId, passTypeId, promptResponses } = await readValidatedBody(
    event,
    redeemPassSchema.parse
  )

  try {
    const redemption = await redeemPass(session.user.id, assignmentId, passTypeId, promptResponses)
    return {
      statusCode: 200,
      data: redemption
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error'
    throw createError({
      statusCode: 500,
      statusMessage: message
    })
  }
})
