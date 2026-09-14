import { defineEventHandler, readBody, createError } from 'h3'
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

  const body = await readBody(event)
  const validation = grantProctorRoleInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input data',
      data: validation.error.flatten()
    })
  }

  const { userId } = validation.data
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
