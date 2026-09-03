import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createReservationNoteInputSchema } from '@@/shared/schemas/cbtf.schema'
import { addReservationNote } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const validation = createReservationNoteInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid note data',
      data: validation.error.flatten()
    })
  }

  const note = await addReservationNote(prisma as any, {
    reservationId: validation.data.reservationId,
    seatNumber: validation.data.seatNumber,
    authorId: session.user.id,
    content: validation.data.content,
    hasPhotos: validation.data.hasPhotos
  })

  return {
    statusCode: 201,
    data: note
  }
})
