import { defineEventHandler, readValidatedBody } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import { updatePassTypeSchema } from '@@/shared/models/pass'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const passType = await prisma.passType.findUnique({
    where: { id }
  })

  if (!passType) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pass Type not found'
    })
  }

  // Check if user has teacher access to this course
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      enrollments: {
        where: { courseId: passType.courseId, role: { in: ['TEACHER', 'ADMIN'] } }
      }
    }
  })

  const isAuthorized = (user?.enrollments.length ?? 0) > 0 || session.user.globalRole === 'ADMIN'

  if (!isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, updatePassTypeSchema.parse)

  const updated = await prisma.passType.update({
    where: { id },
    data: body
  })

  // Sync eligibility if titlePattern changed (or just always to be safe)
  await syncPassTypeEligibility(updated.id)

  return {
    statusCode: 200,
    data: updated
  }
})
