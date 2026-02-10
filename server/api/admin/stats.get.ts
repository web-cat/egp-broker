import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export interface AdminPlatformSummary {
  id: string
  issuer: string
  name: string | null
}

export interface AdminDeploymentSummary {
  id: string
  deploymentId: string
}

export interface AdminStats {
  platforms: number
  deployments: number
  courses: number
  users: number
  platformList: AdminPlatformSummary[]
  deploymentList: AdminDeploymentSummary[]
}

export default defineEventHandler(async (event): Promise<ApiResponse<AdminStats>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const [platforms, deployments, courses, users, platformList, deploymentList] = await Promise.all([
    prisma.ltiPlatform.count(),
    prisma.ltiDeployment.count(),
    prisma.course.count(),
    prisma.user.count(),
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
    data: { platforms, deployments, courses, users, platformList, deploymentList }
  }
})
