import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto[]>> => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const reservations = await prisma.cbtfReservation.findMany({
    where: { userId: session.user.id },
    include: {
      assignment: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
    },
    orderBy: { startTime: 'desc' }
  })

  return {
    statusCode: 200,
    data: reservations.map(toCbtfReservationDto)
  }
})
