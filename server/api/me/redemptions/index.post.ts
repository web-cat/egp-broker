import { defineEventHandler, createError, readBody } from 'h3'
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

    const body = await readBody(event)
    const result = redeemPassSchema.safeParse(body)

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid request data',
            data: result.error.format()
        })
    }

    const { assignmentId, passTypeId, promptResponses } = result.data

    try {
        const redemption = await redeemPass(session.user.id, assignmentId, passTypeId, promptResponses)
        return {
            statusCode: 200,
            data: redemption
        }
    } catch (error: any) {
        // If it's already an H3 error, rethrow it
        if (error.statusCode) throw error

        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Internal Server Error'
        })
    }
})
