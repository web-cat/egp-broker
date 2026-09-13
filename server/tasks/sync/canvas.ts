import prisma from '@@/server/utils/db'
import { syncCourseRosterFromNrps } from '@@/server/utils/nrps'
import { syncCourseAssignmentsFromCanvas } from '@@/server/utils/canvas-sync'

const _defineTask = typeof defineTask !== 'undefined' ? defineTask : <T>(def: T): T => def

export default _defineTask({
  meta: {
    name: 'sync:canvas',
    description: 'Synchronize assignments and course rosters from Canvas daily'
  },
  async run() {
    console.info('[Cron] Starting Canvas roster and assignment sync...')

    const courses = await prisma.course.findMany({
      where: {
        canvasCourseId: { not: null }
      },
      include: {
        deployment: true,
        enrollments: {
          where: {
            role: { in: ['TEACHER', 'TA', 'ADMIN', 'DESIGNER'] }
          },
          include: {
            user: {
              include: {
                ltiIdentities: true
              }
            }
          }
        }
      }
    })

    let syncedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const course of courses) {
      const platformId = course.deployment?.platformId
      if (!platformId) {
        skippedCount++
        continue
      }

      // Find an instructor identity that has an API key for this course's platform
      const teacherIdentity = course.enrollments
        .flatMap((e) => e.user.ltiIdentities)
        .find((ident) => ident.platformId === platformId && Boolean(ident.platformApiKey))

      if (!teacherIdentity?.platformApiKey) {
        // No instructor has provided a Canvas API key for this course
        skippedCount++
        continue
      }

      try {
        console.info(
          `[Cron] Syncing roster and assignments for course "${course.title || course.id}"...`
        )

        // 1. Sync Roster via NRPS (with Canvas API fallback for sections if needed)
        await syncCourseRosterFromNrps(course.id)

        // 2. Sync Assignments (including published status, overrides, and eligibilities)
        await syncCourseAssignmentsFromCanvas(course.id, teacherIdentity.platformApiKey)

        syncedCount++
      } catch (err: any) {
        console.error(`[Cron] Error syncing course ${course.id}:`, err)
        errors.push(`Course ${course.title || course.id}: ${err.message || String(err)}`)
      }
    }

    return {
      result: errors.length === 0 ? 'Success' : 'Partial Failure',
      syncedCourses: syncedCount,
      skippedCourses: skippedCount,
      totalCourses: courses.length,
      errors,
      timestamp: new Date().toISOString()
    }
  }
})
