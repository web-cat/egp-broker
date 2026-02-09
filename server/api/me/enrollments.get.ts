import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { Enrollment, SimpleEnrollment } from '@@/shared/models/enrollment'
import { toSimpleEnrollment } from '@@/shared/models/enrollment'

export default defineEventHandler(async (event): Promise<ApiResponse<SimpleEnrollment[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: session.user.id,
      course: {
        OR: [{ workflowState: 'available' }, { workflowState: 'active' }, { workflowState: null }]
      }
    },
    include: {
      course: true
    }
  })

  const data: SimpleEnrollment[] = enrollments.map((e: Enrollment) => toSimpleEnrollment(e))

  return {
    statusCode: 200,
    data
  }
})
