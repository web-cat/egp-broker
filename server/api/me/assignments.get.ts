import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { matchesTitlePattern } from '@@/server/utils/assignments'

import type { AssignmentRow } from '@@/shared/models/assignment'

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

  // Fetch assignments (including pass eligibilities) for this course
  const assignments = await prisma.assignment.findMany({
    where: { courseId },
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { label: true, title: true } },
      passEligibilities: {
        include: { passType: true }
      }
    }
  })

  const data: AssignmentRow[] = assignments.map((a) => {
    // Determine which pass types are eligible for this assignment
    const eligiblePassTypeNames = a.passEligibilities.map((pe) => pe.passType.name)

    return {
      id: a.id,
      resourceLinkId: a.resourceLinkId,
      title: a.title,
      canvasAssignmentId: a.canvasAssignmentId,
      courseLabel: a.course.label,
      courseTitle: a.course.title,
      dueDate: a.dueDate?.toISOString() ?? null,
      availableFrom: a.availableFrom?.toISOString() ?? null,
      acceptUntil: a.acceptUntil?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      eligiblePassTypeNames
    }
  })

  return {
    statusCode: 200,
    data
  }
})
