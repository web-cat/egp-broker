import type { H3Event } from 'h3'
import { createError } from 'h3'
import prisma from '@@/server/utils/db'

export async function requireCourseContext(event: H3Event): Promise<string> {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Check if courseId is already in the session (if we decide to cache it later)
  // For now, fetch from DB to be safe and consistent with the "Source of Truth" principle
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentCourseId: true }
  })

  const courseId = user?.currentCourseId

  if (!courseId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Course Context Required',
      message: 'Please select a course to continue.'
    })
  }

  return courseId
}
