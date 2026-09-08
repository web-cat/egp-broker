import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { requireCourseContext } from '@@/server/utils/session'
import type { ApiResponse } from '@@/shared/types/api'
import type { RosterSyncStatusData } from '@@/shared/models/course'

export type { RosterSyncStatusData }

export default defineEventHandler(async (event): Promise<ApiResponse<RosterSyncStatusData>> => {
  const session = await getUserSession(event)

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const courseId = await requireCourseContext(event)

  const [course, totalStudents, totalSections, studentsWithSection] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        isRosterSyncing: true,
        lastRosterSyncAt: true
      }
    }),
    prisma.enrollment.count({
      where: { courseId, role: 'STUDENT' }
    }),
    prisma.courseSection.count({
      where: { courseId }
    }),
    prisma.enrollment.count({
      where: { courseId, role: 'STUDENT', courseSectionId: { not: null } }
    })
  ])

  if (!course) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Course not found'
    })
  }

  return {
    statusCode: 200,
    data: {
      isSyncing: Boolean(course.isRosterSyncing),
      lastRosterSyncAt: course.lastRosterSyncAt?.toISOString() ?? null,
      totalStudents,
      totalSections,
      studentsWithSection,
      studentsWithoutSection: Math.max(0, totalStudents - studentsWithSection)
    }
  }
})
