import { z } from 'zod'
import { defineEventHandler, readValidatedBody, createError, getRouterParam } from 'h3'
import prisma from '@@/lib/prisma'

const PlatformUpdateSchema = z.object({
  name: z.string().optional(),
  issuer: z.string().url().optional(),
  clientId: z.string().optional(),
  authEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  jwksEndpoint: z.string().url().optional()
})

export default defineEventHandler(async (event) => {
  // 1. Require Admin session
  const session = await getUserSession(event)
  if (session.user?.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized'
    })
  }

  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, PlatformUpdateSchema.safeParse)

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid update data'
    })
  }

  try {
    const platform = await prisma.ltiPlatform.update({
      where: { id },
      data: body.data
    })

    return platform
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update platform: ${error.message}`
    })
  }
})
