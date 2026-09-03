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
import type { ApiResponse } from '@@/shared/types/api'
import type { CbtfReservationDto } from '@@/shared/models/cbtf'

export default defineEventHandler(async (event): Promise<ApiResponse<CbtfReservationDto>> => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const reservationId = getRouterParam(event, 'id')
  if (!reservationId) {
    throw createError({ statusCode: 400, statusMessage: 'Reservation ID is required' })
  }

  const body = await readBody(event)
  const validation = rescheduleReservationInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid reschedule request',
      data: validation.error.flatten()
    })
  }
  const { startTime: newStartTimeStr } = validation.data

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
  if (newStartTime < new Date()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot reschedule to a time slot in the past'
    })
  }

  const existing = await prisma.cbtfReservation.findUnique({
    where: { id: reservationId },
    include: {
      assignment: true
    }
  })

  if (!existing || existing.userId !== session.user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Reservation not found' })
  }

  if (existing.status !== 'SCHEDULED' && existing.status !== 'MISSED') {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot reschedule reservation in ${existing.status} status`
    })
  }

  // Check for time collision with student's other active reservations
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
  const studentWindow = await getStudentSchedulingWindow(session.user.id, existing.assignment)
  if (newStartTime < studentWindow.start || newEndTime > studentWindow.end) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selected time slot falls outside your test availability window'
    })
  }

  const facility = await getPrimaryCbtfFacility()

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

    const lastReservation = await tx.cbtfReservation.findFirst({
      where: { facilityId: facility.id },
      orderBy: { createdAt: 'desc' },
      select: { seatNumber: true }
    })

    const assignedSeat = assignNextSeat(
      seatOrder,
      newStartTime,
      newEndTime,
      activeReservations,
      lastReservation?.seatNumber
    )

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

  return {
    statusCode: 200,
    data: toCbtfReservationDto(updatedReservation)
  }
})
