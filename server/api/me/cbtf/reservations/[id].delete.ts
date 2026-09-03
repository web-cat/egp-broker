import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto>> => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const reservationId = getRouterParam(event, 'id')
  if (!reservationId) {
    throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
  }

  const existing = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
      assignment: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
    }
  })

  if (!existing || existing.userId !== session.user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  if (existing.status !== 'SCHEDULED') {
    throw createError({
      statusCode: 400,
      statusMessage: `Only scheduled reservations can be cancelled. Current status is ${existing.status}`
    })
  }

  const updated = await prisma.cbtfReservation.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
    include: {
      assignment: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
    }
  })

  return {
    statusCode: 200,
    data: toCbtfReservationDto(updated)
  }
})
