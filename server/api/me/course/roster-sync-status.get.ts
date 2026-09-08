import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { requireCourseContext } from '@@/server/utils/session'
import type { ApiResponse } from '@@/shared/types/api'

export interface RosterSyncStatusData {
  isSyncing: boolean
  lastRosterSyncAt: string | null
}

export default defineEventHandler(async (event): Promise<ApiResponse<RosterSyncStatusData>> => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const courseId = await requireCourseContext(event)

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      isRosterSyncing: true,
      lastRosterSyncAt: true
    }
  })

  if (!course) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Course not found'
    })
  }

  return {
    statusCode: 200,
    data: {
      isSyncing: Boolean(course.isRosterSyncing),
      lastRosterSyncAt: course.lastRosterSyncAt?.toISOString() ?? null
    }
  }
})
