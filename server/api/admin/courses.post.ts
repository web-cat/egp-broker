import { defineEventHandler, readValidatedBody, createError } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import { createCourseSchema, type CourseRow } from '@@/shared/models/course'
import { createCourse } from '@@/server/utils/courses'

export default defineEventHandler(async (event): Promise<ApiResponse<CourseRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createCourseSchema.parse)
  const course = await createCourse(body)

  return {
    statusCode: 201,
    data: course
  }
})
