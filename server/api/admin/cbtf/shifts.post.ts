import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createProctorShiftInputSchema } from '@@/shared/schemas/cbtf.schema'
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
  const validation = createProctorShiftInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid proctor shift data',
      data: validation.error.flatten()
    })
  }

  const { facilityId, userId, startTime, endTime } = validation.data

  const start = new Date(startTime)
  const end = new Date(endTime)

  if (start >= end) {
    throw createError({ statusCode: 400, statusMessage: 'Shift start time must precede end time' })
  }

  const [datePart, timePart] = startTime.includes('T') ? startTime.split('T') : [startTime, '']
  const dateStr = datePart.split(' ')[0]
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  const startTimeStr = timePart ? timePart.substring(0, 5) : start.toISOString().substring(11, 16)
  const endTimePart = endTime.includes('T') ? endTime.split('T')[1] : ''
  const endTimeStr = endTimePart ? endTimePart.substring(0, 5) : end.toISOString().substring(11, 16)

  const shift = await prisma.cbtfProctorShift.create({
    data: {
      facilityId,
      userId,
      date,
      startTime: startTimeStr,
      endTime: endTimeStr
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          globalRole: true,
          avatarUrl: true
        }
      },
      facility: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  return {
    statusCode: 201,
    data: shift
  }
})
