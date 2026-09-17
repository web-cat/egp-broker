import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export interface CourseGtaDto {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

export default defineEventHandler(async (event): Promise<ApiResponse<CourseGtaDto[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Insufficient permissions to view course teaching assistants'
    })
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      role: 'TA'
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }]
  })

  const gtas: CourseGtaDto[] = enrollments.map((e) => ({
    id: e.user.id,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    email: e.user.email,
    avatarUrl: e.user.avatarUrl
  }))

  return {
    statusCode: 200,
    data: gtas
  }
})
