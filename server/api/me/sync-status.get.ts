import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ canSync: boolean }>> => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Get current course and platform
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentCourse: {
        include: {
          deployment: true
        }
      }
    }
  })

  // Basic checks
  if (!user?.currentCourse?.deployment?.platformId) {
    return { statusCode: 200, data: { canSync: false } }
  }

  const platformId = user.currentCourse.deployment.platformId

  // Check for identity with API key
  const identity = await prisma.ltiIdentity.findFirst({
    where: {
      userId: session.user.id,
      platformId: platformId,
      platformApiKey: { not: null }
    }
  })

  return {
    statusCode: 200,
    data: { canSync: !!identity }
  }
})
