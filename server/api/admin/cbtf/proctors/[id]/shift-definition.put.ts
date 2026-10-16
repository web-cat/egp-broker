import { defineEventHandler, getRouterParam, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { updateProctorShiftDefinitionSchema } from '@@/shared/schemas/cbtf.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(
  async (event): Promise<ApiResponse<{ shiftDefinition: string }>> => {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    if (session.user.globalRole !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const proctorId = getRouterParam(event, 'id')
    if (!proctorId) {
      throw createError({ statusCode: 400, statusMessage: 'Proctor ID is required' })
    }

    const user = await prisma.user.findUnique({
      where: { id: proctorId }
    })
    if (!user || user.globalRole !== 'PROCTOR') {
      throw createError({ statusCode: 404, statusMessage: 'Proctor not found' })
    }

    const { shiftDefinition } = await readValidatedBody(event, (body) =>
      updateProctorShiftDefinitionSchema.parse(body)
    )

    const updated = await prisma.user.update({
      where: { id: proctorId },
      data: {
        proctorShiftDefinition: shiftDefinition
      },
      select: {
        id: true,
        proctorShiftDefinition: true
      }
    })

    return {
      statusCode: 200,
      data: {
        id: updated.id,
        proctorShiftDefinition: updated.proctorShiftDefinition
      }
    }
  }
)
