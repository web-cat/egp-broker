import { defineEventHandler, createError, readValidatedBody } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import { updateUserCurrentCourse } from '@@/server/utils/users'
import { CourseContextSchema } from '@@/shared/schemas/course.schema'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const { courseId } = await readValidatedBody(event, CourseContextSchema.parse)

  // Verify the user is actually enrolled in this course
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId
      }
    },
    include: {
      course: true
    }
  })

  if (!enrollment) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not enrolled in this course'
    })
  }

  // Update user with the selected course context in the database
  await updateUserCurrentCourse(session.user.id, enrollment.course.id)

  // Update the session with the new currentCourseId so the client knows
  await setUserSession(event, {
    user: {
      ...session.user,
      currentCourseId: enrollment.course.id
    }
  })

  return {
    statusCode: 200,
    data: { success: true }
  }
})
