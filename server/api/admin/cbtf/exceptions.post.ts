import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createScheduleExceptionInputSchema } from '@@/shared/schemas/cbtf.schema'
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
  const validation = createScheduleExceptionInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid schedule exception',
      data: validation.error.flatten()
    })
  }

  const { facilityId, date, isClosed, openTime, closeTime, reason } = validation.data

  const exceptionDate = new Date(date)
  exceptionDate.setUTCHours(0, 0, 0, 0)

  const record = await prisma.cbtfScheduleException.create({
    data: {
      facilityId,
      date: exceptionDate,
      isClosed: isClosed ?? false,
      openTime: openTime || null,
      closeTime: closeTime || null,
      reason: reason || null
    }
  })

  return {
    statusCode: 201,
    data: record
  }
})
