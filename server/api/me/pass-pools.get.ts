import { defineEventHandler, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimplePassPool } from '@@/shared/models/pass'
import { getStudentPassPools } from '@@/server/utils/pass-types'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'

export default defineEventHandler(async (event): Promise<ApiResponse<SimplePassPool[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context from DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  // We can use getCurrentEnrollment to check validity, but we just need the courseId really.
  // But getCurrentEnrollment handles the fallback logic correctly.
  const enrollment = await getCurrentEnrollment(session.user.id, user?.currentCourseId, session.lti)

  if (!enrollment) {
    return {
      statusCode: 200,
      data: []
    }
  }

  const pools = await getStudentPassPools(session.user.id, enrollment.courseId)

  return {
    statusCode: 200,
    data: pools
  }
})
