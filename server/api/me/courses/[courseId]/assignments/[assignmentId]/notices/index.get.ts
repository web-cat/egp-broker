import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')

  if (!courseId || !assignmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Assignment ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Course staff (Instructor or TA) role required'
    })
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId }
  })

  if (!assignment || assignment.courseId !== courseId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Assignment not found in this course'
    })
  }

  const notices = await prisma.studentAssignmentNotice.findMany({
    where: { assignmentId },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentId: true,
          avatarUrl: true
        }
      },
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return {
    statusCode: 200,
    data: notices
  }
})
