import { defineEventHandler, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { getCourseAssignments } from '@@/server/utils/assignments'

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  const courseId = user?.currentCourseId

  if (!courseId) {
    return {
      statusCode: 200,
      data: []
    }
  }

  const assignments = await getCourseAssignments(courseId)

  return {
    statusCode: 200,
    data: assignments
  }
})
