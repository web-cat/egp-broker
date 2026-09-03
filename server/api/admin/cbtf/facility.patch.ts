import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { updateFacilityInputSchema } from '@@/shared/schemas/cbtf.schema'
import { getPrimaryCbtfFacility } from '@@/server/utils/cbtf'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const validation = updateFacilityInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid facility update parameters',
      data: validation.error.flatten()
    })
  }

  const facility = await getPrimaryCbtfFacility(prisma as any)
  const data: Record<string, any> = {}

  if (validation.data.name !== undefined) {
    data.name = validation.data.name
  }

  if (validation.data.totalSeats !== undefined) {
    data.totalSeats = validation.data.totalSeats
  }

  if (validation.data.seatAllocationOrder !== undefined) {
    data.seatAllocationOrder = validation.data.seatAllocationOrder
  } else if (validation.data.totalSeats !== undefined) {
    // If total seats was changed without custom order, reset to 1..totalSeats
    data.seatAllocationOrder = Array.from({ length: validation.data.totalSeats }, (_, i) => i + 1)
  }

  if (validation.data.checkInLeadMinutes !== undefined) {
    data.checkInLeadMinutes = validation.data.checkInLeadMinutes
  }

  if (validation.data.checkInGraceMinutes !== undefined) {
    data.checkInGraceMinutes = validation.data.checkInGraceMinutes
  }

  const updated = await prisma.cbtfFacility.update({
    where: { id: facility.id },
    data,
    include: {
      operatingHours: true,
      scheduleExceptions: true
    }
  })

  return {
    statusCode: 200,
    data: updated
  }
})
