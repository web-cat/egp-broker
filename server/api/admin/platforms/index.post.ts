import { z } from 'zod'
import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'

const PlatformSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  authEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  jwksEndpoint: z.string().url(),
  name: z.string().optional()
})

export default defineEventHandler(async (event) => {
  // 1. Require Admin session
  const session = await getUserSession(event)
  if (session.user?.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unauthorized: Admin access required'
    })
  }

  // 2. Validate Body
  const body = await readValidatedBody(event, PlatformSchema.safeParse)
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform data'
    })
  }

  const data = body.data

  try {
    // 3. Create the platform
    const platform = await prisma.ltiPlatform.create({
      data: {
        issuer: data.issuer,
        clientId: data.clientId,
        authEndpoint: data.authEndpoint,
        tokenEndpoint: data.tokenEndpoint,
        jwksEndpoint: data.jwksEndpoint,
        name: data.name
      }
    })

    return {
      status: 'success',
      platformId: platform.id
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A platform with this issuer already exists'
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create platform: ${error.message}`
    })
  }
})
