import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  try {
    await prisma.gradeTranslation.delete({
      where: { id }
    })

    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete translation'
    })
  }
})
