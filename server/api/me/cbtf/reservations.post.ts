import { defineEventHandler, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { createReservationInputSchema } from '@@/shared/schemas/cbtf.schema'
import {
  getPrimaryCbtfFacility,
  getFacilityOperatingHoursForDate,
  calculateMaxArrivalsPerSlot,
  assignNextSeat,
  getStudentSchedulingWindow,
  autoExpirePastScheduledReservations,
  toCbtfReservationDto
} from '@@/server/utils/cbtf'
import { combineDateAndTime } from '@@/shared/utils/timezone'
import { syncCbtfReservationCanvasOverride } from '@@/server/utils/cbtf-canvas'
import { notifyCbtfScheduleFailure } from '@@/server/services/alert.service'
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
    const body = await readBody(event)
    if (body?.startTime && typeof body.startTime === 'string') {
      targetSlot = body.startTime
    }

    currentStep = 'Validating Input Schema'
    const validation = createReservationInputSchema.safeParse(body)
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid reservation request',
        data: validation.error.flatten()
      })
    }
    const { assignmentId, startTime: startTimeStr } = validation.data
    targetSlot = startTimeStr

    currentStep = 'Checking 5-Minute Boundary Alignment'
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

    // 2b. Ensure reservation is in the future
    currentStep = 'Verifying Slot Is In The Future'
    if (startTime < new Date()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot schedule a reservation in the past'
      })
    }

    // 3. Verify assignment exists and is schedulable
    currentStep = 'Verifying Assignment Schedulability'
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
        acceptUntil: true,
        course: { select: { label: true, title: true } }
      }
    })

    if (!assignment || !assignment.isSchedulable) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assignment is not configured for CBTF scheduling'
      })
    }
    targetAssignmentTitle = assignment.title
    targetCourseLabel = assignment.course?.label || assignment.course?.title || null

    // 4. Verify enrollment
    currentStep = 'Verifying Course Enrollment'
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

    // 4b. Auto-expire any past-due SCHEDULED reservations for this student to MISSED
    await autoExpirePastScheduledReservations({ userId: session.user.id })

    // 5. Prevent double booking: student cannot have active reservation for this assignment
    currentStep = 'Checking For Double Booking'
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

    // 5b. Prevent time collision: student cannot have another active reservation overlapping this time slot
    currentStep = 'Checking Time Overlap With Other Reservations'
    const conflictingSlot = await prisma.cbtfReservation.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['SCHEDULED', 'CHECKED_IN'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
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

    // 5c. Check if student already completed this exam
    currentStep = 'Checking For Completed Exam'
    const existingCompleted = await prisma.cbtfReservation.findFirst({
      where: {
        userId: session.user.id,
        assignmentId,
        status: { in: ['CHECKED_OUT', 'COMPLETED'] }
      }
    })

    // 6. Verify within student's scheduling window (including retake pass window)
    currentStep = 'Verifying Student Availability Window'
    const studentWindow = await getStudentSchedulingWindow(session.user.id, assignment)
    if (existingCompleted && !studentWindow.isPassWindow) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'You have already completed this exam. A retake pass is required to schedule another attempt.'
      })
    }

    if (startTime < studentWindow.start || endTime > studentWindow.end) {
      throw createError({
        statusCode: 400,
        statusMessage: `Selected slot falls outside your test availability window (${studentWindow.start.toISOString()} to ${studentWindow.end.toISOString()})`
      })
    }

    // Check if there is an uncompleted reservation (CANCELLED or MISSED) that can be reused
    const reusableReservation = await prisma.cbtfReservation.findFirst({
      where: {
        userId: session.user.id,
        assignmentId,
        status: { in: ['CANCELLED', 'MISSED'] }
      },
      orderBy: { updatedAt: 'desc' }
    })

    currentStep = 'Retrieving Testing Facility'
    const facility = await getPrimaryCbtfFacility()

    // 7. Transactional booking with throttle check and seat allocation
    currentStep = 'Booking Reservation & Allocating Seat'
    const newReservation = await prisma.$transaction(async (tx) => {
      // A. Verify facility operating hours for slot date
      const timeZone = facility.timezone || 'America/New_York'
      const hours = await getFacilityOperatingHoursForDate(
        facility.id,
        startTime,
        tx as any,
        timeZone
      )
      if (!hours.isOpen || !hours.openTime || !hours.closeTime) {
        throw createError({
          statusCode: 400,
          statusMessage: hours.reason || 'Testing center is closed on this date'
        })
      }

      const openDateTime = combineDateAndTime(startTime, hours.openTime, timeZone)
      const closeDateTime = combineDateAndTime(startTime, hours.closeTime, timeZone)

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

      // D. Allocate seat based on 5-minute arrival offset
      const seatOrder: number[] = Array.isArray(facility.seatAllocationOrder)
        ? (facility.seatAllocationOrder as number[])
        : Array.from({ length: facility.totalSeats }, (_, i) => i + 1)

      const assignedSeat = assignNextSeat(seatOrder, startTime, endTime, activeReservations)

      // E. Create or reuse reservation
      let created: any
      if (reusableReservation) {
        created = await tx.cbtfReservation.update({
          where: { id: reusableReservation.id },
          data: {
            facilityId: facility.id,
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
      } else {
        created = await tx.cbtfReservation.create({
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
      }

      return created
    })

    currentStep = 'Syncing Canvas Override'
    // Synchronize individual Canvas assignment override (Option A: non-blocking)
    const syncResult = await syncCbtfReservationCanvasOverride(newReservation.id)
    if (syncResult.overrideId) {
      newReservation.canvasOverrideId = syncResult.overrideId
    }

    return {
      statusCode: 201,
      data: toCbtfReservationDto(newReservation)
    }
  } catch (err: any) {
    const errorType = err.statusCode
      ? `HTTP ${err.statusCode} (${err.name || 'H3Error'})`
      : err.name || 'Error'
    const errorMessage = err.statusMessage || err.message || 'Unknown error'
    const errorLocation = `server/api/me/cbtf/reservations.post.ts (${currentStep})`

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
      isReschedule: false
    }).catch((alertErr) =>
      console.warn('[CBTF Alert] Failed to dispatch schedule failure alert:', alertErr)
    )

    throw err
  }
})
