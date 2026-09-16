import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any[]>> => {
  const courseId = getRouterParam(event, 'courseId')
  if (!courseId) {
    throw createError({ statusCode: 400, statusMessage: 'Course ID is required' })
  }

  await assertCourseMember(event, courseId)

  const query = getQuery(event)
  const gtaId = query.gtaId as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined

  const whereClause: any = {
    courseId
  }

  if (gtaId) {
    whereClause.userId = gtaId
  }

  if (startDate || endDate) {
    whereClause.date = {}
    if (startDate) {
      whereClause.date.gte = new Date(`${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      whereClause.date.lte = new Date(`${endDate}T23:59:59.999Z`)
    }
  }

  const shifts = await prisma.gtaShift.findMany({
    where: whereClause,
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
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
  })

  return {
    statusCode: 200,
    data: shifts
  }
})
