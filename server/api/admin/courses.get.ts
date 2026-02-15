import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import type { CourseRow } from '@@/shared/models/course'
import { adminCourseQuerySchema } from '@@/shared/models/course'
import { getAllCourses } from '@@/server/utils/courses'

export default defineEventHandler(async (event): Promise<ApiResponse<CourseRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const query = await getValidatedQuery(event, adminCourseQuerySchema.parse)
  const courses = await getAllCourses(query)

  return {
    statusCode: 200,
    data: courses
  }
})
