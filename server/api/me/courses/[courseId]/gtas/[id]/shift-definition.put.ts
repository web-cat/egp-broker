import { defineEventHandler, getRouterParam, readValidatedBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseInstructorOrSelfGta } from '@@/server/utils/gta-interview'
import { updateGtaShiftDefinitionSchema } from '@@/shared/schemas/gta-interview.schema'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(
  async (event): Promise<ApiResponse<{ shiftDefinition: string }>> => {
    const courseId = getRouterParam(event, 'courseId')
    const gtaId = getRouterParam(event, 'id')

    if (!courseId || !gtaId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Course ID and GTA User ID are required'
      })
    }

    await assertCourseInstructorOrSelfGta(event, courseId, gtaId)

    const { shiftDefinition } = await readValidatedBody(event, (body) =>
      updateGtaShiftDefinitionSchema.parse(body)
    )

    const updated = await prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId: gtaId,
          courseId
        }
      },
      data: {
        shiftDefinition
      }
    })

    return {
      statusCode: 200,
      data: {
        shiftDefinition: updated.shiftDefinition || shiftDefinition
      }
    }
  }
)
