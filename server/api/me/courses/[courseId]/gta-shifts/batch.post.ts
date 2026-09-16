import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseInstructorOrSelfGta } from '@@/server/utils/gta-interview'
import { gtaBatchGenerateShiftsSchema } from '@@/shared/schemas/gta-interview.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const body = await readBody(event)
  const validation = gtaBatchGenerateShiftsSchema.safeParse({
    courseId,
    ...body
  })

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid batch shift parameters',
      data: validation.error.flatten()
    })
  }

  const { userId, startDate, endDate, shifts } = validation.data

  await assertCourseInstructorOrSelfGta(event, courseId, userId)

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)

  const current = new Date(Date.UTC(startYear, startMonth - 1, startDay))
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay))

  const recordsToCreate: Array<{
    courseId: string
    userId: string
    date: Date
    startTime: string
    endTime: string
  }> = []

  while (current <= end) {
    const dayOfWeek = current.getUTCDay()
    const year = current.getUTCFullYear()
    const month = String(current.getUTCMonth() + 1).padStart(2, '0')
    const day = String(current.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const shiftDate = new Date(`${dateStr}T00:00:00.000Z`)

    const matchingSlots = shifts.filter((s) => s.dayOfWeek === dayOfWeek)
    for (const slot of matchingSlots) {
      recordsToCreate.push({
        courseId,
        userId,
        date: shiftDate,
        startTime: slot.startTime,
        endTime: slot.endTime
      })
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  if (recordsToCreate.length === 0) {
    return {
      statusCode: 200,
      data: {
        count: 0,
        shifts: []
      }
    }
  }

  const createdShifts = await prisma.$transaction(
    recordsToCreate.map((record) =>
      prisma.gtaShift.create({
        data: record,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true
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
