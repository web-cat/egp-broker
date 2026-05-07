// server/api/proxy/grade-translations.get.ts
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return await prisma.gradeTranslation.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { name: 'asc' }
  })
})
