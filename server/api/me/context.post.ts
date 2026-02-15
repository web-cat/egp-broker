import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { updateUserCurrentCourse } from '@@/server/utils/users'

export default defineEventHandler(async (event): Promise<ApiResponse<{ success: boolean }>> => {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const { courseId } = body

  if (!courseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing courseId'
    })
  }

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
