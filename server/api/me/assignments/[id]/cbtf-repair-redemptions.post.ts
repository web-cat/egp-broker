import { defineEventHandler, createError, getRouterParam } from 'h3'
import type { ApiResponse } from '@@/shared/types/api'
import { repairAssignmentCbtfPassRedemptions } from '@@/server/utils/redemptions'
import type { RepairCbtfRedemptionsResponse } from '@@/shared/schemas/cbtf.schema'

export default defineEventHandler(
  async (event): Promise<ApiResponse<RepairCbtfRedemptionsResponse>> => {
    const session = await getUserSession(event)

    if (!session.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    if (session.user.globalRole !== 'ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Global administrator privileges required'
      })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assignment ID is required'
      })
    }

    const result = await repairAssignmentCbtfPassRedemptions(id)

    return {
      statusCode: 200,
      data: result
    }
  }
)
