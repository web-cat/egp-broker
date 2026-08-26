import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRedemptionRow } from '@@/shared/models/teacher'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { getAssignmentRedemptions } from '@@/server/utils/teacher'

export default defineEventHandler(
  async (event): Promise<ApiResponse<AssignmentRedemptionRow[]>> => {
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
      select: { currentCourseId: true, role: true }
    })

    const enrollment = await getCurrentEnrollment(
      session.user.id,
      user?.currentCourseId,
      session.lti
    )

    if (!enrollment && user?.role !== 'ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    const courseId = enrollment ? enrollment.courseId : user?.currentCourseId
    if (!courseId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Course context required'
      })
    }

    const redemptions = await getAssignmentRedemptions(assignmentId, courseId)

    return {
      statusCode: 200,
      data: redemptions
    }
  }
)
