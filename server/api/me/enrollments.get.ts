import { defineEventHandler, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { SimpleEnrollment } from '@@/shared/models/enrollment'
import { getUserEnrollments } from '@@/server/utils/enrollments'

export default defineEventHandler(async (event): Promise<ApiResponse<SimpleEnrollment[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const enrollments = await getUserEnrollments(session.user.id)

  return {
    statusCode: 200,
    data: enrollments
  }
})
