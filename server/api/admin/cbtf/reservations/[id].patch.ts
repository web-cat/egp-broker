import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import {
  syncCbtfReservationCanvasOverride,
  deleteCbtfReservationCanvasOverride
} from '@@/server/utils/cbtf-canvas'
import { cbtfAdminUpdateReservationSchema } from '@@/shared/schemas/cbtf.schema'
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

  const existing = await prisma.cbtfReservation.findUnique({
    where: { id }
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  const rawBody = await readBody(event)
  const body = cbtfAdminUpdateReservationSchema.parse(rawBody)

  const data: Record<string, any> = {}

  if (body.status) {
    data.status = body.status
    if (body.status === 'CHECKED_OUT' && !existing.checkedOutAt) {
      data.checkedOutAt = new Date()
      data.checkedOutByUserId = session.user.id
    } else if (body.status === 'CHECKED_IN' && !existing.checkedInAt) {
      data.checkedInAt = new Date()
      data.checkedInByUserId = session.user.id
    }
  }

  if (body.seatNumber !== undefined) {
    data.seatNumber = body.seatNumber
  }

  if (body.startTime) {
    data.startTime = new Date(body.startTime)
  }

  if (body.endTime) {
    data.endTime = new Date(body.endTime)
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
          email: true,
          studentId: true,
          avatarUrl: true
        }
      }
    }
  })

  // Synchronize changes to Canvas assignment overrides where possible
  if (data.status === 'CANCELLED') {
    await deleteCbtfReservationCanvasOverride(id)
  } else if (data.startTime || data.endTime || data.status === 'SCHEDULED') {
    await syncCbtfReservationCanvasOverride(id)
  }

  return {
    statusCode: 200,
    data: toCbtfReservationDto(updated)
  }
})
