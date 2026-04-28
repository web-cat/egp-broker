import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/lib/prisma'

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
    const body = await readBody(event)
    
    // Basic validation
    if (!body.name || !body.mapping) {
      throw createError({ statusCode: 400, statusMessage: 'Name and mapping are required' })
    }

    const result = await prisma.gradeTranslation.create({
      data: {
        name: body.name,
        description: body.description,
        mapping: body.mapping // Prisma handles JSON objects automatically
      }
    })
    return result
  }
})