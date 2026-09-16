import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  const reservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      studentId: session.user.id,
      assignment: { courseId }
    },
    include: {
      assignment: {
        select: { id: true, title: true }
      },
      gta: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    },
    orderBy: { startTime: 'desc' }
  })

  return {
    statusCode: 200,
    data: reservations
  }
})
