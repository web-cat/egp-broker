import { defineEventHandler, readValidatedBody, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { updateGradeTranslationSchema } from '@@/shared/models/grade-translation'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateGradeTranslationSchema.parse)

  try {
    const updated = await prisma.gradeTranslation.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        maxScore: body.maxScore,
        mapping: body.mapping as any
      }
    })
    return { data: updated }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update translation'
    })
  }
})
