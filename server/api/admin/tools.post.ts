import { defineEventHandler, readValidatedBody } from 'h3'
import prisma from '@@/lib/prisma'
import type { ApiResponse } from '@@/shared/types/api'
import type { ToolRow } from '@@/shared/models/tool'
import { createToolSchema } from '@@/shared/models/tool'

export default defineEventHandler(async (event): Promise<ApiResponse<ToolRow>> => {
  const session = await getUserSession(event)

  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const body = await readValidatedBody(event, createToolSchema.parse)

  const tool = await prisma.ltiTool.create({
    data: body,
    include: {
      platform: {
        select: {
          issuer: true
        }
      }
    }
  })

  return {
    statusCode: 201,
    data: {
      id: tool.id,
      name: tool.name,
      baseUrl: tool.baseUrl,
      protocol: tool.protocol,
      platformId: tool.platformId,
      platformIssuer: tool.platform?.issuer ?? null,
      createdAt: tool.createdAt.toISOString()
    }
  }
})
