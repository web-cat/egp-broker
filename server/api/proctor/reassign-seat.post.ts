import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { reassignReservationSeat } from '@@/server/utils/cbtf'
import { syncCbtfReservationCanvasOverride } from '@@/server/utils/cbtf-canvas'
import { cbtfProctorReassignSeatSchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const rawBody = await readBody(event)
  const body = cbtfProctorReassignSeatSchema.parse(rawBody)

  const updated = await reassignReservationSeat(
    prisma,
    body.reservationId,
    body.targetSeatNumber,
    session.user.id
  )

  try {
    await syncCbtfReservationCanvasOverride(body.reservationId)
  } catch {
    // Non-fatal if canvas override fails
  }

  return {
    statusCode: 200,
    data: updated
  }
})
