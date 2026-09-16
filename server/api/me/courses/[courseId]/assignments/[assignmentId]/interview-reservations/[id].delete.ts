import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')
  const id = getRouterParam(event, 'id')

  if (!courseId || !assignmentId || !id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID, Assignment ID, and Reservation ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)

  const reservation = await prisma.gtaInterviewReservation.findUnique({
    where: { id }
  })

  if (!reservation || reservation.assignmentId !== assignmentId) {
    throw createError({ statusCode: 404, statusMessage: 'Interview reservation not found' })
  }

  // Caller must be the student who booked it, or an instructor in the course
  if (reservation.studentId !== auth.userId && !auth.isInstructor) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You can only cancel your own reservations'
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
