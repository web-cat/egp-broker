import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { upsertOperatingHoursInputSchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const { facilityId, dayOfWeek, openTime, closeTime } = await readValidatedBody(
    event,
    upsertOperatingHoursInputSchema.parse
  )

  const record = await prisma.cbtfOperatingHours.upsert({
    where: {
      facilityId_dayOfWeek: {
        facilityId,
        dayOfWeek
      }
    },
    update: { openTime, closeTime },
    create: { facilityId, dayOfWeek, openTime, closeTime }
  })

  return {
    statusCode: 200,
    data: record
  }
})
