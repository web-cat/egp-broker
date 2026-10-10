import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { grantProctorRoleInputSchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const { userId } = await readValidatedBody(event, grantProctorRoleInputSchema.parse)
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      globalRole: 'PROCTOR'
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      globalRole: true,
      avatarUrl: true
    }
  })

  return {
    statusCode: 200,
    data: user
  }
})
