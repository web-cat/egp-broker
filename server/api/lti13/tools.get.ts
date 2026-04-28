// server/api/lti13/tools.get.ts
import prisma from '@@/lib/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return await prisma.ltiTool.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { name: 'asc' }
  })
})
