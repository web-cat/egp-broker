import { defineEventHandler, getRouterParam, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { toCbtfReservationDto } from '@@/server/utils/cbtf'
import {
  syncCbtfReservationCanvasOverride,
  deleteCbtfReservationCanvasOverride
} from '@@/server/utils/cbtf-canvas'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

function formatSkipReason(reason?: string): string {
  switch (reason) {
    case 'external_tool':
      return 'Assignment is hosted on an external tool and does not support Canvas overrides.'
    case 'missing_canvas_ids':
      return 'Assignment or course is missing required Canvas IDs.'
    case 'no_student_canvas_id':
      return 'Student does not have a linked Canvas account ID.'
    case 'no_instructor_key':
      return 'No instructor Canvas API key is available to create overrides.'
    case 'no_platform':
      return 'LTI platform is not configured.'
    default:
      return reason || 'Not applicable for this reservation'
  }
}

export default defineEventHandler(
  async (
    event
  ): Promise<ApiResponse<CbtfReservationDto> & { warning?: boolean; error?: boolean }> => {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const role = session.user.globalRole
    if (role !== 'PROCTOR' && role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
    }

    const reservation = await prisma.cbtfReservation.findUnique({
      where: { id },
      include: {
        assignment: { select: { title: true } },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            studentId: true,
            avatarUrl: true
          }
        }
      }
    })

    if (!reservation) {
      throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
    }

    if (reservation.status === 'CANCELLED') {
      await deleteCbtfReservationCanvasOverride(id)
      return {
        statusCode: 200,
        data: toCbtfReservationDto(reservation),
        message: 'Reservation is cancelled; Canvas override was removed if present.'
      }
    }

    const syncResult = await syncCbtfReservationCanvasOverride(id)

    if (syncResult.status === 'created' || syncResult.status === 'updated') {
      const updated = await prisma.cbtfReservation.findUnique({
        where: { id },
        include: {
          assignment: { select: { title: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              studentId: true,
              avatarUrl: true
            }
          }
        }
      })

      return {
        statusCode: 200,
        data: toCbtfReservationDto(updated || reservation),
        message: `Canvas override synced successfully (ID: #${syncResult.overrideId})`
      }
    }

    if (syncResult.status === 'skipped') {
      return {
        statusCode: 200,
        data: toCbtfReservationDto(reservation),
        warning: true,
        message: `Canvas sync skipped: ${formatSkipReason(syncResult.reason)}`
      }
    }

    return {
      statusCode: 200,
      data: toCbtfReservationDto(reservation),
      error: true,
      message: `Canvas sync failed: ${syncResult.error || 'Unknown error'}`
    }
  }
)
