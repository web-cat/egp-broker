import { defineEventHandler, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createGradeTranslationSchema } from '@@/shared/models/grade-translation'

export default defineEventHandler(async (event) => {
  // 1. Check Permissions (ensure only admins can save)
  const session = await getUserSession(event)
  if (!session.user || session.user.globalRole !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
  }

  const method = event.method

  // --- GET: Fetch all translations for the table ---
  if (method === 'GET') {
    const translations = await prisma.gradeTranslation.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return { data: translations }
  }

  // --- POST: Create a new translation ---
  if (method === 'POST') {
    const body = await readValidatedBody(event, createGradeTranslationSchema.parse)

    const result = await prisma.gradeTranslation.create({
      data: {
        name: body.name,
        description: body.description,
        maxScore: body.maxScore ?? 1.0,
        mapping: body.mapping as any
      }
    })
    return { data: result }
  }
})
