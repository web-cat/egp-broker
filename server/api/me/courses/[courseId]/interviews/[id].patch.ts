import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { updateGtaInterviewReservationInputSchema } from '@@/shared/schemas/gta-interview.schema'
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

  const body = await readBody(event)
  const validation = updateGtaInterviewReservationInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: validation.error.issues[0]?.message || 'Invalid input data'
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

  // GTAs can only update reservations assigned to them; instructors/admins can update any in the course
  if (!auth.isInstructor && reservation.gtaId !== auth.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You can only update your own assigned interviews'
    })
  }

  const updateData: any = {}
  const { status, notes } = validation.data

  if (status) {
    updateData.status = status
    if (status === 'CHECKED_IN') {
      updateData.checkedInAt = new Date()
    } else if (status === 'CHECKED_OUT' || status === 'COMPLETED') {
      updateData.checkedOutAt = new Date()
    }
  }

  if (notes !== undefined) {
    updateData.notes = notes
  }

  const updated = await prisma.gtaInterviewReservation.update({
    where: { id: reservationId },
    data: updateData,
    include: {
      assignment: {
        select: { id: true, title: true }
      },
      student: {
        select: { id: true, firstName: true, lastName: true, email: true }
      },
      gta: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    }
  })

  return {
    statusCode: 200,
    data: updated
  }
})
