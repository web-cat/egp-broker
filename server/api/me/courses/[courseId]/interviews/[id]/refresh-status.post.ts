import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { refreshReservationSubmissionStatus } from '@@/server/utils/passport'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const reservationId = getRouterParam(event, 'id')
  if (!reservationId) {
    throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Graduate TA or Instructor role required'
    })
  }

  const reservation = await prisma.gtaInterviewReservation.findFirst({
    where: {
      id: reservationId,
      assignment: { courseId }
    }
  })

  if (!reservation) {
    throw createError({ statusCode: 404, statusMessage: 'Interview reservation not found' })
  }

  if (!auth.isInstructor && reservation.gtaId !== auth.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You can only refresh status for your own assigned interviews'
    })
  }

  const updatedReservation = await refreshReservationSubmissionStatus(reservationId)

  return {
    statusCode: 200,
    data: updatedReservation
  }
})
