import { defineEventHandler, getValidatedQuery, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { searchUserByEmailSchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const { email } = await getValidatedQuery(event, searchUserByEmailSchema.parse)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      globalRole: true,
      avatarUrl: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: `User not found with email: ${email}`
    })
  }

  return {
    statusCode: 200,
    data: user
  }
})
