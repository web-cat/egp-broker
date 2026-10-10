import { defineEventHandler, readValidatedBody, createError } from 'h3'
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

  const validationData = await readValidatedBody(event, updateFacilityInputSchema.parse)

  const facility = await getPrimaryCbtfFacility(prisma as any)
  const data: Record<string, any> = {}

  if (validationData.name !== undefined) {
    data.name = validationData.name
  }

  if (validationData.totalSeats !== undefined) {
    data.totalSeats = validationData.totalSeats
  }

  if (validationData.seatAllocationOrder !== undefined) {
    data.seatAllocationOrder = validationData.seatAllocationOrder
  } else if (validationData.totalSeats !== undefined) {
    // If total seats was changed without custom order, reset to 1..totalSeats
    data.seatAllocationOrder = Array.from({ length: validationData.totalSeats }, (_, i) => i + 1)
  }

  if (validationData.checkInLeadMinutes !== undefined) {
    data.checkInLeadMinutes = validationData.checkInLeadMinutes
  }

  if (validationData.checkInGraceMinutes !== undefined) {
    data.checkInGraceMinutes = validationData.checkInGraceMinutes
  }

  if (validationData.timezone !== undefined) {
    data.timezone = validationData.timezone
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
