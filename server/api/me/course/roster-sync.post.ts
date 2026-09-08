import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { requireCourseContext } from '@@/server/utils/session'
import { acquireRosterSyncLock, syncCourseRosterFromNrps } from '@@/server/utils/nrps'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(
  async (event): Promise<ApiResponse<{ isSyncing: boolean; message?: string }>> => {
    const session = await getUserSession(event)

    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const courseId = await requireCourseContext(event)

    // Verify staff role
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId
        }
      },
      select: { role: true }
    })

    const isStaff =
      session.user.globalRole === 'ADMIN' ||
      (enrollment && ['TEACHER', 'TA', 'ADMIN', 'DESIGNER'].includes(enrollment.role))

    if (!isStaff) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden'
      })
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { isRosterSyncing: true, nrpsContextMembershipsUrl: true }
    })

    if (!course) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Course not found'
      })
    }

    if (course.isRosterSyncing) {
      return {
        statusCode: 200,
        data: {
          isSyncing: true,
          message: 'Roster sync is already in progress'
        }
      }
    }

    const acquired = await acquireRosterSyncLock(courseId)
    if (acquired) {
      syncCourseRosterFromNrps(courseId).catch((err) => {
        console.error(`[NRPS] Manual sync failed for course ${courseId}:`, err)
      })
    }

    return {
      statusCode: 200,
      data: {
        isSyncing: true
      }
    }
  }
)
