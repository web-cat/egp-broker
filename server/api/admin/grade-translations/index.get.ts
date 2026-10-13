import { defineEventHandler, createError } from 'h3'
import prisma from '@@/server/utils/db'
import type { ApiResponse } from '@@/shared/types/api'
import {
  gradeTranslationSelect,
  type GradeTranslationRow
} from '@@/shared/models/grade-translation'

export default defineEventHandler(async (event): Promise<ApiResponse<GradeTranslationRow[]>> => {
  const session = await getUserSession(event)
  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const translations = await prisma.gradeTranslation.findMany({
    select: gradeTranslationSelect,
    orderBy: { createdAt: 'desc' }
  })

  return {
    statusCode: 200,
    data: translations.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    }))
  }
})
