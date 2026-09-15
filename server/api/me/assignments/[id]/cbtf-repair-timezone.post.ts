import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { repairAssignmentCbtfTimezones } from '@@/server/utils/cbtf-canvas'
import type { RepairCbtfTimezonesResponse } from '@@/shared/schemas/cbtf.schema'

export default defineEventHandler(
  async (event): Promise<ApiResponse<RepairCbtfTimezonesResponse>> => {
    const session = await getUserSession(event)

    if (!session.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assignment ID is required'
      })
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { id: true, courseId: true, isSchedulable: true }
    })

    if (!assignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Assignment not found'
      })
    }

    if (!assignment.isSchedulable) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assignment is not configured for CBTF scheduling'
      })
    }

    // Check if caller is teacher/admin in the course or global admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        enrollments: {
          where: { courseId: assignment.courseId, role: { in: ['TEACHER', 'ADMIN'] } }
        }
      }
    })

    const isAuthorized = (user?.enrollments.length ?? 0) > 0 || session.user.globalRole === 'ADMIN'
    if (!isAuthorized) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Administrator or course teacher privileges required'
      })
    }

    const result = await repairAssignmentCbtfTimezones(assignment.id, session.user.id)

    return {
      statusCode: 200,
      data: result
    }
  }
)
