import { defineEventHandler, createError, getRouterParam } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { repairAssignmentGtaTimezones } from '@@/server/utils/gta-repair-timezone'
import type { RepairGtaTimezonesResponse } from '@@/shared/schemas/gta-interview.schema'

export default defineEventHandler(
  async (event): Promise<ApiResponse<RepairGtaTimezonesResponse>> => {
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
      select: { id: true, courseId: true, hasInterviews: true }
    })

    if (!assignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Assignment not found'
      })
    }

    if (!assignment.hasInterviews) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This assignment is not configured for GTA grading interviews'
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

    const result = await repairAssignmentGtaTimezones(assignment.id, session.user.id)

    return {
      statusCode: 200,
      data: result
    }
  }
)
