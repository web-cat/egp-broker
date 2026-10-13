import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationNoteDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationNoteDto[]>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const query = getQuery(event)
  const reservationId = typeof query.reservationId === 'string' ? query.reservationId : ''

  if (!reservationId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
  }

  const notes = await prisma.cbtfReservationNote.findMany({
    where: { reservationId },
    include: {
      author: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  const dtos = notes.map((n) => ({
    id: n.id,
    reservationId: n.reservationId,
    authorId: n.authorId,
    authorName: `${n.author.firstName} ${n.author.lastName}`.trim(),
    content: n.content,
    hasPhotos: n.hasPhotos,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString()
  }))

  return {
    statusCode: 200,
    data: dtos
  }
})
