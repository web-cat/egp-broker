import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { SyncStatusResponse } from '@@/shared/schemas/sync.schema'

export default defineEventHandler(async (event): Promise<ApiResponse<SyncStatusResponse>> => {
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
          deployment: {
            include: {
              platform: true
            }
          }
        }
      }
    }
  })

  // Basic checks
  if (!user?.currentCourse?.deployment?.platformId) {
    return {
      statusCode: 200,
      data: {
        canSync: false,
        hasCourseContext: false,
        platformName: null
      }
    }
  }

  const platformId = user.currentCourse.deployment.platformId
  const platformName =
    user.currentCourse.deployment.platform.name ||
    user.currentCourse.deployment.platform.issuer ||
    'Canvas'

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
    data: {
      canSync: !!identity,
      hasCourseContext: true,
      platformName
    }
  }
})
