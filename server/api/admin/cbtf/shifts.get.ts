import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const shifts = await prisma.cbtfProctorShift.findMany({
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
    },
    orderBy: { startTime: 'desc' }
  })

  return {
    statusCode: 200,
    data: shifts
  }
})
