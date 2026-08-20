import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { savePlatformApiKeySchema } from '@@/shared/schemas/sync.schema'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { apiKey } = await readValidatedBody(event, (body) => savePlatformApiKeySchema.parse(body))

  // 1. Get current course context and user role validation
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      currentCourseId: true,
      currentCourse: {
        select: {
          id: true,
          deployment: {
            select: {
              id: true,
              platform: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      }
    }
  })

  const course = user?.currentCourse
  if (!course || !course.deployment || !course.deployment.platform) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course context or LTI configuration missing'
    })
  }

  // Check enrollment/role
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id
      }
    }
  })

  if (!enrollment || !['TEACHER', 'TA', 'ADMIN', 'DESIGNER'].includes(enrollment.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Find the platform identity for this user and platform
  const platformIdentity = await prisma.ltiIdentity.findUnique({
    where: {
      userId_platformId: {
        userId: user.id,
        platformId: course.deployment.platform.id
      }
    }
  })

  if (!platformIdentity) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No LTI identity found. Please launch from the LMS first.'
    })
  }

  // Update the platform API key
  await prisma.ltiIdentity.update({
    where: {
      userId_platformId: {
        userId: user.id,
        platformId: course.deployment.platform.id
      }
    },
    data: {
      platformApiKey: apiKey
    }
  })

  return {
    statusCode: 200,
    data: { success: true }
  }
})
