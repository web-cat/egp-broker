import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const courseId = getRouterParam(event, 'courseId')
  const id = getRouterParam(event, 'id')

  if (!courseId || !id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Interview ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only instructors and GTAs can cancel appointments'
    })
  }

  const reservation = await prisma.gtaInterviewReservation.findUnique({
    where: { id },
    include: {
      assignment: true
    }
  })

  if (!reservation || reservation.assignment.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'Interview reservation not found' })
  }

  if (!auth.isInstructor && auth.userId !== reservation.gtaId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Teaching Assistants can only cancel their own appointments'
    })
  }

  if (reservation.status !== 'SCHEDULED') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot cancel an interview reservation with status ${reservation.status}`
    })
  }

  await prisma.gtaInterviewReservation.update({
    where: { id },
    data: {
      status: 'CANCELLED'
    }
  })

  return {
    statusCode: 200,
    data: { success: true }
  }
})
