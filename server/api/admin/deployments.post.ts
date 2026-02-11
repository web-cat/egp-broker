import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { createDeploymentSchema } from '@@/shared/models/deployment'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
    const session = await getUserSession(event)

    if (!session.user || session.user.globalRole !== 'ADMIN') {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden'
        })
    }

    const body = await readValidatedBody(event, createDeploymentSchema.parse)

    const deployment = await prisma.ltiDeployment.create({
        data: body
    })

    return {
        statusCode: 201,
        data: deployment
    }
})
