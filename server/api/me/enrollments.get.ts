import { defineEventHandler } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { CourseRole } from '@prisma/client'

export interface SimpleEnrollment {
  id: string
  courseId: string
  courseTitle: string | null
  courseLabel: string | null
  role: CourseRole
}

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
      course: {
        select: {
          id: true,
          title: true,
          label: true
        }
      }
    }
  })

  const data: SimpleEnrollment[] = enrollments.map((e) => ({
    id: e.id,
    courseId: e.courseId,
    courseTitle: e.course.title,
    courseLabel: e.course.label,
    role: e.role
  }))

  return {
    statusCode: 200,
    data
  }
})
