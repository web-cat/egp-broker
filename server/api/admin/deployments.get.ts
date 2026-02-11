import { defineEventHandler, getQuery } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
    const session = await getUserSession(event)

    if (!session.user || session.user.globalRole !== 'ADMIN') {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden'
        })
    }

    const query = getQuery(event)
    const platformFilter = query.p as string | undefined

    const where: Record<string, unknown> = {}
    if (platformFilter) {
        where.platformId = platformFilter
    }

    const deployments = await prisma.ltiDeployment.findMany({
        where,
        include: {
            platform: {
                select: {
                    name: true,
                    issuer: true
                }
            },
            _count: {
                select: { courses: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return {
        statusCode: 200,
        data: deployments.map((d) => ({
            id: d.id,
            platformId: d.platformId,
            deploymentId: d.deploymentId,
            deploymentHost: d.deploymentHost,
            platformName: d.platform.name,
            platformIssuer: d.platform.issuer,
            courseCount: d._count.courses,
            createdAt: d.createdAt.toISOString()
        }))
    }
})
