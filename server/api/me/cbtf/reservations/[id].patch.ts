import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { rescheduleReservationInputSchema } from '@@/shared/schemas/cbtf.schema'
import {
  getPrimaryCbtfFacility,
  getFacilityOperatingHoursForDate,
  combineDateAndTime,
  calculateMaxArrivalsPerSlot,
  assignNextSeat,
  getStudentSchedulingWindow,
  toCbtfReservationDto
} from '@@/server/utils/cbtf'
import { syncCbtfReservationCanvasOverride } from '@@/server/utils/cbtf-canvas'
import {
  notifyCbtfScheduleSuccess,
  notifyCbtfScheduleFailure
} from '@@/server/services/alert.service'
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto>> => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentInfo = {
    studentName: session.user.firstName
      ? `${session.user.firstName} ${session.user.lastName || ''}`.trim()
      : null,
    studentEmail: session.user.email || null,
    studentId: session.user.studentId || null
  }
  let currentStep = 'Initial Request Parsing'
  let targetSlot: string | null = null
  let targetAssignmentTitle: string | null = null
  let targetCourseLabel: string | null = null

  try {
    const reservationId = getRouterParam(event, 'id')
    if (!reservationId) {
      throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
    }

    const body = await readBody(event)
    if (body?.startTime && typeof body.startTime === 'string') {
      targetSlot = body.startTime
    }

    currentStep = 'Validating Input Schema'
    const validation = rescheduleReservationInputSchema.safeParse(body)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid reschedule request',
        data: validation.error.flatten()
      })
    }
    const { startTime: newStartTimeStr } = validation.data
    targetSlot = newStartTimeStr

    currentStep = 'Checking 5-Minute Boundary Alignment'
    const newStartTime = new Date(newStartTimeStr)
    if (isNaN(newStartTime.getTime())) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid start time format' })
    }

    if (
      newStartTime.getUTCMinutes() % 5 !== 0 ||
      newStartTime.getUTCSeconds() !== 0 ||
      newStartTime.getUTCMilliseconds() !== 0
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Reservation must align with a 5-minute boundary'
      })
    }

    const newEndTime = new Date(newStartTime.getTime() + 60 * 60 * 1000)

    // Ensure new time is in the future
    currentStep = 'Verifying Slot Is In The Future'
    if (newStartTime < new Date()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot reschedule to a time slot in the past'
      })
    }

    currentStep = 'Retrieving Existing Reservation'
    const existing = await prisma.cbtfReservation.findUnique({
      where: { id: reservationId },
      include: {
        assignment: {
          include: {
            course: { select: { label: true, title: true } }
          }
        }
      }
    })

    if (!existing || existing.userId !== session.user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
    }
    targetAssignmentTitle = existing.assignment?.title || null
    targetCourseLabel =
      existing.assignment?.course?.label || existing.assignment?.course?.title || null

    currentStep = 'Verifying Reservation Status'
    if (existing.status !== 'SCHEDULED' && existing.status !== 'MISSED') {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot reschedule reservation in ${existing.status} status`
      })
    }

    // Check for time collision with student's other active reservations
    currentStep = 'Checking Time Overlap With Other Reservations'
    const conflictingSlot = await prisma.cbtfReservation.findFirst({
      where: {
        userId: session.user.id,
        id: { not: existing.id },
        status: { in: ['SCHEDULED', 'CHECKED_IN'] },
        startTime: { lt: newEndTime },
        endTime: { gt: newStartTime }
      },
      include: {
        assignment: { select: { title: true } }
      }
    })
    if (conflictingSlot) {
      throw createError({
        statusCode: 409,
        statusMessage: `You already have an active test reservation for "${conflictingSlot.assignment?.title || 'another assignment'}" overlapping this time slot`
      })
    }

    // Verify within student scheduling window
    currentStep = 'Verifying Student Availability Window'
    const studentWindow = await getStudentSchedulingWindow(session.user.id, existing.assignment)
    if (newStartTime < studentWindow.start || newEndTime > studentWindow.end) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Selected time slot falls outside your test availability window'
      })
    }

    currentStep = 'Retrieving Testing Facility'
    const facility = await getPrimaryCbtfFacility()

    currentStep = 'Rescheduling Reservation & Reallocating Seat'
    const updatedReservation = await prisma.$transaction(async (tx) => {
      const hours = await getFacilityOperatingHoursForDate(facility.id, newStartTime, tx as any)
      if (!hours.isOpen || !hours.openTime || !hours.closeTime) {
        throw createError({
          statusCode: 400,
          statusMessage: hours.reason || 'Testing center is closed on this date'
        })
      }

      const openDateTime = combineDateAndTime(newStartTime, hours.openTime)
      const closeDateTime = combineDateAndTime(newStartTime, hours.closeTime)

      if (newStartTime < openDateTime || newEndTime > closeDateTime) {
        throw createError({
          statusCode: 400,
          statusMessage: `Reservation must finish before closing time (${hours.closeTime})`
        })
      }

      // Check throttle limit at new slot (excluding current reservation)
      const maxArrivals = calculateMaxArrivalsPerSlot(facility.totalSeats)
      const concurrentArrivals = await tx.cbtfReservation.count({
        where: {
          facilityId: facility.id,
          id: { not: existing.id },
          startTime: newStartTime,
          status: { in: ['SCHEDULED', 'CHECKED_IN'] }
        }
      })

      if (concurrentArrivals >= maxArrivals) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Arrival capacity reached for this time slot'
        })
      }

      // Check capacity at new slot (excluding current reservation)
      const activeReservations = await tx.cbtfReservation.findMany({
        where: {
          facilityId: facility.id,
          id: { not: existing.id },
          status: { in: ['SCHEDULED', 'CHECKED_IN'] },
          startTime: { lt: newEndTime },
          endTime: { gt: newStartTime }
        },
        select: { seatNumber: true }
      })

      if (activeReservations.length >= facility.totalSeats) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Testing facility is completely full during this time slot'
        })
      }

      const seatOrder: number[] = Array.isArray(facility.seatAllocationOrder)
        ? (facility.seatAllocationOrder as number[])
        : Array.from({ length: facility.totalSeats }, (_, i) => i + 1)

      const assignedSeat = assignNextSeat(seatOrder, newStartTime, newEndTime, activeReservations)

      const updated = await tx.cbtfReservation.update({
        where: { id: existing.id },
        data: {
          startTime: newStartTime,
          endTime: newEndTime,
          seatNumber: assignedSeat,
          status: 'SCHEDULED'
        },
        include: {
          assignment: { select: { title: true } },
          user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
        }
      })

      return updated
    })

    currentStep = 'Syncing Canvas Override'
    // Synchronize individual Canvas assignment override (Option A: non-blocking)
    const syncResult = await syncCbtfReservationCanvasOverride(updatedReservation.id)
    if (syncResult.overrideId) {
      updatedReservation.canvasOverrideId = syncResult.overrideId
    }

    // Dispatch non-blocking admin push alert on success
    await notifyCbtfScheduleSuccess({
      studentName: updatedReservation.user?.firstName
        ? `${updatedReservation.user.firstName} ${updatedReservation.user.lastName || ''}`.trim()
        : studentInfo.studentName,
      studentEmail: studentInfo.studentEmail,
      studentId: updatedReservation.user?.studentId || studentInfo.studentId,
      assignmentTitle: updatedReservation.assignment?.title || targetAssignmentTitle,
      courseLabel: targetCourseLabel,
      startTime: updatedReservation.startTime,
      endTime: updatedReservation.endTime,
      seatNumber: updatedReservation.seatNumber,
      facilityName: facility.name,
      isReschedule: true
    }).catch((alertErr) =>
      console.warn('[CBTF Alert] Failed to dispatch reschedule success alert:', alertErr)
    )

    return {
      statusCode: 200,
      data: toCbtfReservationDto(updatedReservation)
    }
  } catch (err: any) {
    const errorType = err.statusCode
      ? `HTTP ${err.statusCode} (${err.name || 'H3Error'})`
      : err.name || 'Error'
    const errorMessage = err.statusMessage || err.message || 'Unknown error'
    const errorLocation = `server/api/me/cbtf/reservations/[id].patch.ts (${currentStep})`

    await notifyCbtfScheduleFailure({
      studentName: studentInfo.studentName,
      studentEmail: studentInfo.studentEmail,
      studentId: studentInfo.studentId,
      assignmentTitle: targetAssignmentTitle,
      courseLabel: targetCourseLabel,
      timeSlot: targetSlot,
      errorType,
      errorMessage,
      errorLocation,
      isReschedule: true
    }).catch((alertErr) =>
      console.warn('[CBTF Alert] Failed to dispatch reschedule failure alert:', alertErr)
    )

    throw err
  }
})
