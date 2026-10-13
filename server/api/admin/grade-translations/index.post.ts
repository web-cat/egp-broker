import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import {
  createGradeTranslationSchema,
  gradeTranslationSelect,
  type GradeTranslationRow
} from '@@/shared/models/grade-translation'

export default defineEventHandler(async (event): Promise<ApiResponse<GradeTranslationRow>> => {
  const session = await getUserSession(event)
  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, createGradeTranslationSchema.parse)

  const result = await prisma.gradeTranslation.create({
    data: {
      name: body.name,
      description: body.description,
      maxScore: body.maxScore ?? 1.0,
      mapping: body.mapping as any
    },
    select: gradeTranslationSelect
  })

  return {
    statusCode: 201,
    data: {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString()
    }
  }
})
