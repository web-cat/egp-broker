import { defineEventHandler, createError } from 'h3'
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

  // Clear current course context from the user record in database
  const updatedUser = await updateUserCurrentCourse(session.user.id, null)

  //  console.log('[context.delete] updatedUser = ', updatedUser)

  // Update session to reflect the change
  // Explicitly remove currentCourseId from the old user object before constructing the new one
  // to ensure we don't have duplicate keys and the null value takes precedence
  const { user: _oldUser, ...sessionWithoutUser } = session

  // const newSession =
  await replaceUserSession(event, {
    user: updatedUser,
    ...sessionWithoutUser
    // user: {
    //   ...userWithoutCourse,
    //   currentCourseId: null
    // }
  })

  // console.log('[context.delete] newSession = ', newSession)

  return {
    statusCode: 200,
    data: { success: true }
  }
})
