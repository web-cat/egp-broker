import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { deleteCbtfReservationCanvasOverride } from '@@/server/utils/cbtf-canvas'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<{ id: string }>> => {
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

  const existing = await prisma.cbtfReservation.findUnique({
    where: { id }
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  // Delete individual Canvas assignment override if present before deleting reservation record
  await deleteCbtfReservationCanvasOverride(id)

  await prisma.cbtfReservation.delete({
    where: { id }
  })

  return {
    statusCode: 200,
    data: { id },
    message: 'Reservation deleted successfully'
  }
})
