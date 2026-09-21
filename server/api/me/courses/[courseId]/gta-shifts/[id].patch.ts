import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import {
  assertCourseInstructorOrSelfGta,
  assertUserIsCourseGta
} from '@@/server/utils/gta-interview'
import { reconcileShiftReservations } from '@@/server/utils/gta-shift-rescheduling'
import { updateGtaShiftInputSchema } from '@@/shared/schemas/gta-interview.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  const id = getRouterParam(event, 'id')

  if (!courseId || !id) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID and Shift ID are required' })
  }

  const existing = await prisma.gtaShift.findUnique({
    where: { id }
  })

  if (!existing || existing.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'GTA shift not found' })
  }

  const body = await readBody(event)
  const validation = updateGtaShiftInputSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid shift update parameters',
      data: validation.error.flatten()
    })
  }

  await assertCourseInstructorOrSelfGta(event, courseId, existing.userId)

  const { userId, date, startTime, endTime } = validation.data

  if (userId && userId !== existing.userId) {
    await assertUserIsCourseGta(courseId, userId)
  }

  // Automatically reschedule or cancel reservations that no longer fit
  const impact = await reconcileShiftReservations(courseId, id, {
    userId,
    date,
    startTime,
    endTime
  })

  const updateData: any = {}
  if (userId) updateData.userId = userId
  if (date) updateData.date = new Date(`${date}T00:00:00.000Z`)
  if (startTime) updateData.startTime = startTime
  if (endTime) updateData.endTime = endTime

  const updated = await prisma.gtaShift.update({
    where: { id },
    data: updateData,
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

  return {
    statusCode: 200,
    data: {
      ...updated,
      impact
    }
  }
})
