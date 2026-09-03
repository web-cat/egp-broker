import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto[]>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const reservations = await prisma.cbtfReservation.findMany({
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
    },
    orderBy: { startTime: 'desc' },
    take: 200
  })

  return {
    statusCode: 200,
    data: reservations.map(toCbtfReservationDto)
  }
})
