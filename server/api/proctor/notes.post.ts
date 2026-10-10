import { defineEventHandler, readValidatedBody, createError } from 'h3'
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

  const noteInput = await readValidatedBody(event, createReservationNoteInputSchema.parse)

  const note = await addReservationNote(prisma as any, {
    reservationId: noteInput.reservationId,
    seatNumber: noteInput.seatNumber,
    authorId: session.user.id,
    content: noteInput.content,
    hasPhotos: noteInput.hasPhotos
  })

  return {
    statusCode: 201,
    data: note
  }
})
