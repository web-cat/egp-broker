import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseInstructorOrSelfGta } from '@@/server/utils/gta-interview'
import { reconcileShiftReservations } from '@@/server/utils/gta-shift-rescheduling'
import {
  previewShiftImpactInputSchema,
  type ShiftImpactSummary
} from '@@/shared/schemas/gta-interview.schema'

export default defineEventHandler(async (event): Promise<ShiftImpactSummary> => {
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

  await assertCourseInstructorOrSelfGta(event, courseId, existing.userId)

  const body = (await readBody(event)) || {}
  const validation = previewShiftImpactInputSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid shift preview parameters',
      data: validation.error.flatten()
    })
  }

  const { isDelete, userId, date, startTime, endTime } = validation.data

  if (isDelete) {
    return reconcileShiftReservations(courseId, id, null, undefined, true)
  }

  return reconcileShiftReservations(
    courseId,
    id,
    {
      userId,
      date,
      startTime,
      endTime
    },
    undefined,
    true
  )
})
