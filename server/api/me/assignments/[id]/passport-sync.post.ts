import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { resyncAssignmentPassPortExtensions } from '@@/server/utils/passport'

export interface PassPortResyncResult {
  syncedCount: number
  failedCount: number
  totalCount: number
}

export default defineEventHandler(async (event): Promise<ApiResponse<PassPortResyncResult>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const assignmentId = getRouterParam(event, 'id')
  if (!assignmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment ID is required'
    })
  }

  // Get current user and enrollment context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true, globalRole: true }
  })

  const enrollment = await getCurrentEnrollment(session.user.id, user?.currentCourseId, session.lti)

  if (
    (!enrollment || !['TEACHER', 'TA', 'ADMIN', 'DESIGNER'].includes(enrollment.role)) &&
    user?.globalRole !== 'ADMIN'
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const result = await resyncAssignmentPassPortExtensions(assignmentId)

  return {
    statusCode: 200,
    data: result
  }
})
