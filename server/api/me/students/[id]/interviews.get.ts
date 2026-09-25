import { defineEventHandler, createError, getRouterParam, getQuery } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { StudentInterviewHistoryRow } from '@@/shared/models/teacher'
import { getCurrentEnrollment } from '@@/server/utils/enrollments'
import { getStudentInterviewHistory } from '@@/server/utils/teacher'
import { assertCourseMember } from '@@/server/utils/gta-interview'

export default defineEventHandler(
  async (event): Promise<ApiResponse<StudentInterviewHistoryRow[]>> => {
    const session = await getUserSession(event)

    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const studentId = getRouterParam(event, 'id')
    if (!studentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Student ID is required'
      })
    }

    // Get current user and enrollment context
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentCourseId: true, globalRole: true }
    })

    const enrollment = await getCurrentEnrollment(
      session.user.id,
      user?.currentCourseId,
      session.lti
    )

    if (!enrollment && user?.globalRole !== 'ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    const query = getQuery(event)
    const courseId =
      (query.courseId as string) || (enrollment ? enrollment.courseId : user?.currentCourseId)
    if (!courseId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Course context required'
      })
    }

    const auth = await assertCourseMember(event, courseId)
    if (!auth.isInstructor && !auth.isGta) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Graduate TA or Instructor role required'
      })
    }

    const history = await getStudentInterviewHistory(studentId, courseId)

    return {
      statusCode: 200,
      data: history
    }
  }
)
