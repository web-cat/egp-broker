import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { cbtfBatchGenerateShiftsSchema } from '@@/shared/schemas/cbtf.schema'
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
  const validation = cbtfBatchGenerateShiftsSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid batch shift parameters',
      data: validation.error.flatten()
    })
  }

  const { facilityId, userId, startDate, endDate, shifts } = validation.data

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T23:59:59Z`)

  const recordsToCreate: Array<{
    facilityId: string
    userId: string
    startTime: Date
    endTime: Date
  }> = []

  const current = new Date(start)
  while (current <= end) {
    const dayOfWeek = current.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const year = current.getUTCFullYear()
    const month = String(current.getUTCMonth() + 1).padStart(2, '0')
    const day = String(current.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const matchingSlots = shifts.filter((s) => s.dayOfWeek === dayOfWeek)
    for (const slot of matchingSlots) {
      const shiftStart = new Date(`${dateStr}T${slot.startTime}:00.000Z`)
      const shiftEnd = new Date(`${dateStr}T${slot.endTime}:00.000Z`)
      recordsToCreate.push({
        facilityId,
        userId,
        startTime: shiftStart,
        endTime: shiftEnd
      })
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  if (recordsToCreate.length === 0) {
    return {
      statusCode: 201,
      data: {
        count: 0,
        shifts: []
      }
    }
  }

  const createdShifts = await prisma.$transaction(
    recordsToCreate.map((record) =>
      prisma.cbtfProctorShift.create({
        data: record,
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
    )
  )

  return {
    statusCode: 201,
    data: {
      count: createdShifts.length,
      shifts: createdShifts
    }
  }
})
