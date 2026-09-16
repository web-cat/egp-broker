import { defineEventHandler, getQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import { cbtfReservationQuerySchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'
import type { Prisma } from '@prisma/client'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto[]>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = session.user.globalRole
  if (role !== 'PROCTOR' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const rawQuery = getQuery(event)
  const parsed = cbtfReservationQuerySchema.safeParse(rawQuery)
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 50, upcomingOnly: true }

  const where: Prisma.CbtfReservationWhereInput = {}

  // 1. Search student name, email, or student ID
  if (query.search) {
    const term = query.search.trim()
    where.user = {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { studentId: { contains: term, mode: 'insensitive' } }
      ]
    }
  }

  // 2. Status filter
  if (query.status && query.status !== 'ALL') {
    where.status = query.status as any
  }

  // 3. Date / Time range applied to start date
  if (query.from || query.to) {
    where.startTime = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {})
    }
  } else if (query.upcomingOnly !== false) {
    where.startTime = { gte: new Date() }
  }

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const skip = (page - 1) * pageSize
  const take = pageSize

  const [total, reservations] = await Promise.all([
    prisma.cbtfReservation.count({ where }),
    prisma.cbtfReservation.findMany({
      where,
      include: {
        assignment: { select: { title: true } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            studentId: true,
            avatarUrl: true
          }
        },
        notes: { select: { id: true } }
      },
      orderBy: { startTime: 'asc' },
      skip,
      take
    })
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    statusCode: 200,
    data: reservations.map(toCbtfReservationDto),
    pagination: {
      total,
      page,
      pageSize,
      totalPages
    }
  }
})
