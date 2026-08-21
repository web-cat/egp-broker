import { defineEventHandler } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'

import type { AdminStats } from '@@/shared/models/stats'

export default defineEventHandler(async (event): Promise<ApiResponse<AdminStats>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const [
    platforms,
    deployments,
    courses,
    users,
    tools,
    casServers,
    gradeTranslations,
    platformList,
    deploymentList
  ] = await Promise.all([
    prisma.ltiPlatform.count(),
    prisma.ltiDeployment.count(),
    prisma.course.count(),
    prisma.user.count(),
    prisma.ltiTool.count(),
    prisma.casServer.count(),
    prisma.gradeTranslation.count(),
    prisma.ltiPlatform.findMany({
      select: { id: true, issuer: true, name: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.ltiDeployment.findMany({
      select: { id: true, deploymentId: true },
      orderBy: { createdAt: 'desc' }
    })
  ])

  return {
    statusCode: 200,
    data: {
      platforms,
      deployments,
      courses,
      users,
      tools,
      casServers,
      gradeTranslations,
      platformList,
      deploymentList
    }
  }
})
