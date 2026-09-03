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

  const shift = await prisma.cbtfProctorShift.create({
    data: {
      facilityId,
      userId,
      startTime: start,
      endTime: end
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
