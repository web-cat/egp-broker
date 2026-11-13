import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')
  const studentId = getRouterParam(event, 'studentId')

  if (!courseId || !assignmentId || !studentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID, Assignment ID, and Student ID are required'
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

  const existing = await prisma.studentAssignmentNotice.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId
      }
    }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notice not found for this student on the specified assignment'
    })
  }

  await prisma.studentAssignmentNotice.delete({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId
      }
    }
  })

  return {
    statusCode: 200,
    data: { success: true }
  }
})
