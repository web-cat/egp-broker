import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

import type { CourseRow } from '@@/shared/models/course'

export default defineEventHandler(async (event): Promise<ApiResponse<CourseRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = getQuery(event)
  const deploymentIdParam = query.d as string | undefined
  const platformIdParam = query.p as string | undefined

  // Build the where clause: optionally filter by deployment or platform
  const where: Record<string, unknown> = {}
  if (deploymentIdParam) {
    const deployment = await prisma.ltiDeployment.findFirst({
      where: { deploymentId: deploymentIdParam },
      select: { id: true }
    })
    if (!deployment) {
      throw createError({
        statusCode: 404,
        statusMessage: `Deployment "${deploymentIdParam}" not found`
      })
    }
    where.deploymentId = deployment.id
  } else if (platformIdParam) {
    where.deployment = { platformId: platformIdParam }
  }

  const courses = await prisma.course.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { enrollments: true, assignments: true }
      }
    }
  })

  const data: CourseRow[] = courses.map((c) => ({
    id: c.id,
    ltiContextId: c.ltiContextId,
    label: c.label,
    title: c.title,
    enrollmentCount: c._count.enrollments,
    assignmentCount: c._count.assignments,
    createdAt: c.createdAt.toISOString()
  }))

  return {
    statusCode: 200,
    data
  }
})
