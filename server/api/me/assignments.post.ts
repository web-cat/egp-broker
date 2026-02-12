import { defineEventHandler, readValidatedBody } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { createAssignmentSchema } from '@@/shared/models/assignment'

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

  // courseId in body should match the current course context if provided,
  // but we enforce the context's courseId for security in /api/me/...

  const assignment = await prisma.assignment.create({
    data: {
      resourceLinkId: `manual-${Date.now()}`,
      title: body.title,
      canvasAssignmentId: body.canvasAssignmentId,
      courseId: courseId, // Always use the teacher's current course
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      availableFrom: body.availableFrom ? new Date(body.availableFrom) : null,
      acceptUntil: body.acceptUntil ? new Date(body.acceptUntil) : null
    }
  })

  // Sync automatic pass eligibility
  await syncAssignmentEligibility(assignment.id)

  return {
    statusCode: 201,
    data: assignment
  }
})
