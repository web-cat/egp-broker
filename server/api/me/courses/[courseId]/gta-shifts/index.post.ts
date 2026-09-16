import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseInstructorOrSelfGta } from '@@/server/utils/gta-interview'
import { createGtaShiftInputSchema } from '@@/shared/schemas/gta-interview.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const body = await readBody(event)
  const validation = createGtaShiftInputSchema.safeParse({
    courseId,
    ...body
  })

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid GTA shift data',
      data: validation.error.flatten()
    })
  }

  const { userId, date, startTime, endTime } = validation.data

  await assertCourseInstructorOrSelfGta(event, courseId, userId)

  const shiftDate = new Date(`${date}T00:00:00.000Z`)

  const shift = await prisma.gtaShift.create({
    data: {
      courseId,
      userId,
      date: shiftDate,
      startTime,
      endTime
    },
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
    statusCode: 201,
    data: shift
  }
})
