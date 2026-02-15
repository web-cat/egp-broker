import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { createAssignmentSchema } from '@@/shared/models/assignment'
import { createAssignment } from '@@/server/utils/assignments'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Get current course context and verify teacher access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentCourseId: true,
      enrollments: {
        where: { role: { in: ['TEACHER', 'ADMIN'] } },
        select: { courseId: true }
      }
    }
  })

  const courseId = user?.currentCourseId
  const isAuthorized =
    user?.enrollments.some((e) => e.courseId === courseId) || session.user.globalRole === 'ADMIN'

  if (!courseId || !isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createAssignmentSchema.parse)

  // Enforce the context's courseId
  const assignment = await createAssignment({
    ...body,
    courseId
  })

  return {
    statusCode: 201,
    data: assignment
  }
})
