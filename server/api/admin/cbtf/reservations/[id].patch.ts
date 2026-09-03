import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  const body = await readBody(event)
  const allowedStatuses = ['SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'MISSED', 'CANCELLED']

  const data: Record<string, any> = {}
  if (body.status && allowedStatuses.includes(body.status)) {
    data.status = body.status
    if (body.status === 'CHECKED_OUT') {
      data.checkedOutAt = new Date()
      data.checkedOutByUserId = session.user.id
    }
  }

  if (body.seatNumber && typeof body.seatNumber === 'number') {
    data.seatNumber = body.seatNumber
  }

  const updated = await prisma.cbtfReservation.update({
    where: { id },
    data,
    include: {
      assignment: { select: { title: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  return {
    statusCode: 200,
    data: toCbtfReservationDto(updated)
  }
})
