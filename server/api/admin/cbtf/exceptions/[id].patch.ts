import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { updateScheduleExceptionInputSchema } from '@@/shared/schemas/cbtf.schema'
import { extractCalendarDate, DEFAULT_CBTF_TIMEZONE } from '@@/shared/utils/timezone'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Exception ID is required' })
  }

  const validationData = await readValidatedBody(event, updateScheduleExceptionInputSchema.parse)

  const existing = await prisma.cbtfScheduleException.findUnique({
    where: { id }
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule exception not found' })
  }

  const data: Record<string, any> = {}

  if (validationData.date !== undefined) {
    const calendarDate = extractCalendarDate(validationData.date, DEFAULT_CBTF_TIMEZONE)
    data.date = new Date(`${calendarDate}T00:00:00.000Z`)
  }

  if (validationData.isClosed !== undefined) {
    data.isClosed = validationData.isClosed
  }

  if (validationData.openTime !== undefined) {
    data.openTime = validationData.openTime || null
  }

  if (validationData.closeTime !== undefined) {
    data.closeTime = validationData.closeTime || null
  }

  if (validationData.reason !== undefined) {
    data.reason = validationData.reason || null
  }

  const updated = await prisma.cbtfScheduleException.update({
    where: { id },
    data
  })

  return {
    statusCode: 200,
    data: updated
  }
})
