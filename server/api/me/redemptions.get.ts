import { defineEventHandler, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { RedemptionRow } from '@@/shared/models/pass'
import { getStudentRedemptions } from '@@/server/utils/redemptions'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'

export default defineEventHandler(async (event): Promise<ApiResponse<RedemptionRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context from user session or DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  const enrollment = await getCurrentEnrollment(session.user.id, user?.currentCourseId, session.lti)

  if (!enrollment) {
    return {
      statusCode: 200,
      data: []
    }
  }

  const redemptions = await getStudentRedemptions(session.user.id, enrollment.courseId)

  return {
    statusCode: 200,
    data: redemptions
  }
})
