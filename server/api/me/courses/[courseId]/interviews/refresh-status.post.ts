import { defineEventHandler, getRouterParam, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { refreshBatchGtaInterviewStatusInputSchema } from '@@/shared/schemas/gta-interview.schema'
import { refreshBatchReservationSubmissionStatus } from '@@/server/utils/passport'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const auth = await assertCourseMember(event, courseId)
  if (!auth.isInstructor && !auth.isGta) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Graduate TA or Instructor role required'
    })
  }

  const { reservationIds } = await readValidatedBody(
    event,
    refreshBatchGtaInterviewStatusInputSchema.parse
  )

  const reservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      id: { in: reservationIds },
      assignment: { courseId }
    },
    select: { id: true, gtaId: true }
  })

  if (reservations.length !== reservationIds.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'One or more interview reservations not found in this course'
    })
  }

  if (!auth.isInstructor) {
    const hasUnauthorized = reservations.some((r) => r.gtaId !== auth.userId)
    if (hasUnauthorized) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: You can only refresh status for your own assigned interviews'
      })
    }
  }

  const updatedReservations = await refreshBatchReservationSubmissionStatus(reservationIds)

  return {
    statusCode: 200,
    data: updatedReservations
  }
})
