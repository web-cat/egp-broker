import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimpleEnrollment } from '@@/shared/models/enrollment'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'

export default defineEventHandler(async (event): Promise<ApiResponse<SimpleEnrollment | null>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Fetch user to get currentCourseId (could be optimized if session had it, but DB is safer)
  // Actually, we need to fetch user to see *latest* currentCourseId, session might be stale?
  // But session strategy is usually DB backed or JWT?
  // Assuming we fetch from DB to be sure.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  const enrollment = await getCurrentEnrollment(session.user.id, user?.currentCourseId, session.lti)

  return {
    statusCode: 200,
    data: enrollment
  }
})
