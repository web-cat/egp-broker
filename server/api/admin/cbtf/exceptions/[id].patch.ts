import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
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

  const body = await readBody(event)
  const validation = updateScheduleExceptionInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid schedule exception update parameters',
      data: validation.error.flatten()
    })
  }

  const existing = await prisma.cbtfScheduleException.findUnique({
    where: { id }
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule exception not found' })
  }

  const data: Record<string, any> = {}

  if (validation.data.date !== undefined) {
    const calendarDate = extractCalendarDate(validation.data.date, DEFAULT_CBTF_TIMEZONE)
    data.date = new Date(`${calendarDate}T00:00:00.000Z`)
  }

  if (validation.data.isClosed !== undefined) {
    data.isClosed = validation.data.isClosed
  }

  if (validation.data.openTime !== undefined) {
    data.openTime = validation.data.openTime || null
  }

  if (validation.data.closeTime !== undefined) {
    data.closeTime = validation.data.closeTime || null
  }

  if (validation.data.reason !== undefined) {
    data.reason = validation.data.reason || null
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
