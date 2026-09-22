import { defineEventHandler, createError, getRouterParam, readValidatedBody } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { TeacherForceRedeemPassResponse } from '@@/shared/models/teacher'
import { teacherForceRedeemPassSchema } from '@@/shared/models/teacher'
import { teacherForceRedeemPass } from '@@/server/utils/redemptions'

export default defineEventHandler(
  async (event): Promise<ApiResponse<TeacherForceRedeemPassResponse>> => {
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

    // Verify teacher / admin role in the current course
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        currentCourseId: true,
        globalRole: true,
        enrollments: {
          where: { role: { in: ['TEACHER', 'ADMIN', 'TA'] } },
          select: { courseId: true }
        }
      }
    })

    const courseId = user?.currentCourseId
    const isAuthorized =
      user?.globalRole === 'ADMIN' ||
      (courseId ? user?.enrollments.some((e) => e.courseId === courseId) : false)

    if (!courseId || !isAuthorized) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    const body = await readValidatedBody(event, teacherForceRedeemPassSchema.parse)

    const result = await teacherForceRedeemPass({
      userId: studentId,
      courseId,
      instructorUserId: session.user.id,
      assignmentId: body.assignmentId,
      passTypeId: body.passTypeId,
      deductFromBalance: body.deductFromBalance,
      availableFrom: body.availableFrom,
      dueDate: body.dueDate,
      acceptUntil: body.acceptUntil
    })

    return {
      statusCode: 200,
      data: result
    }
  }
)
