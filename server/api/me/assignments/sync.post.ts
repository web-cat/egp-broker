import { defineEventHandler } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import type { AssignmentRow } from '@@/shared/models/assignment'
import { getCourseAssignments } from '@@/server/utils/assignments'
import { syncCourseAssignmentsFromCanvas } from '@@/server/utils/canvas-sync'

export default defineEventHandler(async (event): Promise<ApiResponse<AssignmentRow[]>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 1. Get current course context and user role validation
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      currentCourseId: true,
      currentCourse: {
        select: {
          id: true,
          canvasCourseId: true,
          deployment: {
            select: {
              id: true,
              deploymentHost: true,
              platform: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      }
    }
  })

  const course = user?.currentCourse
  if (!course || !course.deployment || !course.deployment.platform) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course context or LTI configuration missing'
    })
  }

  // Check enrollment/role
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id
      }
    }
  })

  if (!enrollment || !['TEACHER', 'TA', 'ADMIN', 'DESIGNER'].includes(enrollment.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const platformIdentity = await prisma.ltiIdentity.findUnique({
    where: {
      userId_platformId: {
        userId: user.id,
        platformId: course.deployment.platform.id
      }
    }
  })

  if (!platformIdentity || !platformIdentity.platformApiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No LTI API Key found. Please launch from the LMS first.'
    })
  }

  if (!course.canvasCourseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canvas Course ID not found in course context.'
    })
  }

  // 2. Delegate synchronization to headless utility
  await syncCourseAssignmentsFromCanvas(course.id, platformIdentity.platformApiKey)

  // 3. Return updated assignment list with complete projection including published status
  const assignments = await getCourseAssignments(course.id, user.id)

  return {
    statusCode: 200,
    data: assignments
  }
})
