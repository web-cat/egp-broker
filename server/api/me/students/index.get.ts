import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { StudentRosterRow } from '@@/shared/models/teacher'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { getCourseStudentRoster } from '@@/server/utils/teacher'

export default defineEventHandler(async (event): Promise<ApiResponse<StudentRosterRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current user and enrollment context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true, globalRole: true }
  })

  const enrollment = await getCurrentEnrollment(session.user.id, user?.currentCourseId, session.lti)

  if (!enrollment && user?.globalRole !== 'ADMIN') {
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

  const students = await getCourseStudentRoster(courseId)

  return {
    statusCode: 200,
    data: students
  }
})
