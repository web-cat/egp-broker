import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseInstructorOrSelfGta } from '@@/server/utils/gta-interview'
import { reconcileShiftReservations } from '@@/server/utils/gta-shift-rescheduling'
import type { ShiftImpactSummary } from '@@/shared/schemas/gta-interview.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(
  async (event): Promise<ApiResponse<{ success: boolean; impact: ShiftImpactSummary }>> => {
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

    // Automatically reschedule or cancel reservations that belonged to this shift
    const impact = await reconcileShiftReservations(courseId, id, null)

    await prisma.gtaShift.delete({
      where: { id }
    })

    return {
      statusCode: 200,
      data: {
        success: true,
        impact
      }
    }
  }
)
