import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  try {
    return await prisma.gradeTranslation.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        mapping: body.mapping
      }
    })
  } catch (error) {
    throw createError({ 
      statusCode: 500, 
      statusMessage: 'Failed to update translation' 
    })
  }
})