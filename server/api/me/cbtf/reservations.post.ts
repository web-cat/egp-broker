import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createReservationInputSchema } from '@@/shared/schemas/cbtf.schema'
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

  const body = await readBody(event)
  const validation = createReservationInputSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid reservation request',
      data: validation.error.flatten()
    })
  }
  const { assignmentId, startTime: startTimeStr } = validation.data

  const startTime = new Date(startTimeStr)
  if (isNaN(startTime.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid start time format' })
  }

  // 1. Enforce 5-minute boundary alignment
  if (
    startTime.getUTCMinutes() % 5 !== 0 ||
    startTime.getUTCSeconds() !== 0 ||
    startTime.getUTCMilliseconds() !== 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Reservation must align with a 5-minute boundary (e.g. :00, :05, :10)'
    })
  }

  // 2. Test reservations are strictly 1 hour
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

  // 3. Verify assignment exists and is schedulable
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      courseId: true,
      title: true,
      isSchedulable: true,
      scheduleWindowStart: true,
      scheduleWindowEnd: true,
      availableFrom: true,
      dueDate: true,
      acceptUntil: true
    }
  })

  if (!assignment || !assignment.isSchedulable) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Assignment is not configured for CBTF scheduling'
    })
  }

  // 4. Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId: assignment.courseId
    }
  })
  if (!enrollment && session.user.globalRole === 'USER') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not enrolled in this course'
    })
  }

  // 5. Prevent double booking: student cannot have active reservation for this assignment
  const existingActive = await prisma.cbtfReservation.findFirst({
    where: {
      userId: session.user.id,
      assignmentId,
      status: { in: ['SCHEDULED', 'CHECKED_IN'] }
    }
  })
  if (existingActive) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'You already have an active reservation for this assignment. Please reschedule or cancel it.'
    })
  }

  // 6. Verify within student's scheduling window (including retake pass window)
  const studentWindow = await getStudentSchedulingWindow(session.user.id, assignment)
  if (startTime < studentWindow.start || endTime > studentWindow.end) {
    throw createError({
      statusCode: 400,
      statusMessage: `Selected slot falls outside your test availability window (${studentWindow.start.toISOString()} to ${studentWindow.end.toISOString()})`
    })
  }

  const facility = await getPrimaryCbtfFacility()

  // 7. Transactional booking with throttle check and seat allocation
  const newReservation = await prisma.$transaction(async (tx) => {
    // A. Verify facility operating hours for slot date
    const hours = await getFacilityOperatingHoursForDate(facility.id, startTime, tx as any)
    if (!hours.isOpen || !hours.openTime || !hours.closeTime) {
      throw createError({
        statusCode: 400,
        statusMessage: hours.reason || 'Testing center is closed on this date'
      })
    }

    const openDateTime = combineDateAndTime(startTime, hours.openTime)
    const closeDateTime = combineDateAndTime(startTime, hours.closeTime)

    if (startTime < openDateTime || endTime > closeDateTime) {
      throw createError({
        statusCode: 400,
        statusMessage: `Reservation must finish before closing time (${hours.closeTime})`
      })
    }

    // B. Enforce arrival throttle limit: ceil(totalSeats / 12)
    const maxArrivals = calculateMaxArrivalsPerSlot(facility.totalSeats)
    const concurrentArrivals = await tx.cbtfReservation.count({
      where: {
        facilityId: facility.id,
        startTime,
        status: { in: ['SCHEDULED', 'CHECKED_IN'] }
      }
    })

    if (concurrentArrivals >= maxArrivals) {
      throw createError({
        statusCode: 409,
        statusMessage: `Arrival capacity reached for this 5-minute time slot (maximum ${maxArrivals} arrivals)`
      })
    }

    // C. Enforce room capacity: active reservations overlapping [startTime, endTime)
    const activeReservations = await tx.cbtfReservation.findMany({
      where: {
        facilityId: facility.id,
        status: { in: ['SCHEDULED', 'CHECKED_IN'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      },
      select: { seatNumber: true }
    })

    if (activeReservations.length >= facility.totalSeats) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Testing facility is completely full during this time slot'
      })
    }

    // D. Fetch last assigned reservation to continue seat allocation sequence
    const lastReservation = await tx.cbtfReservation.findFirst({
      where: { facilityId: facility.id },
      orderBy: { createdAt: 'desc' },
      select: { seatNumber: true }
    })

    const seatOrder: number[] = Array.isArray(facility.seatAllocationOrder)
      ? (facility.seatAllocationOrder as number[])
      : Array.from({ length: facility.totalSeats }, (_, i) => i + 1)

    const assignedSeat = assignNextSeat(
      seatOrder,
      startTime,
      endTime,
      activeReservations,
      lastReservation?.seatNumber
    )

    // E. Create reservation
    const created = await tx.cbtfReservation.create({
      data: {
        facilityId: facility.id,
        assignmentId,
        userId: session.user.id,
        seatNumber: assignedSeat,
        startTime,
        endTime,
        status: 'SCHEDULED'
      },
      include: {
        assignment: { select: { title: true } },
        user: { select: { firstName: true, lastName: true, studentId: true, avatarUrl: true } }
      }
    })

    return created
  })

  return {
    statusCode: 201,
    data: toCbtfReservationDto(newReservation)
  }
})
