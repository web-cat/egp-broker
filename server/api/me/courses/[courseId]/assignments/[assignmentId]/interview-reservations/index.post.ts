import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import prisma from '@@/server/utils/db'
import { assertCourseMember } from '@@/server/utils/gta-interview'
import { createGtaInterviewReservationInputSchema } from '@@/shared/schemas/gta-interview.schema'
import {
  INTERVIEW_DURATION_MINUTES,
  GTA_INTERVIEW_MIN_LEAD_HOURS,
  GTA_INTERVIEW_MIN_LEAD_MS
} from '@@/server/utils/gta-slots'
import {
  DEFAULT_GTA_TIMEZONE,
  getLocalDateString,
  getLocalTimeParts
} from '@@/shared/utils/timezone'
import type { ApiResponse } from '@@/shared/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse<any>> => {
  const courseId = getRouterParam(event, 'courseId')
  const assignmentId = getRouterParam(event, 'assignmentId')

  if (!courseId || !assignmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course ID and Assignment ID are required'
    })
  }

  const auth = await assertCourseMember(event, courseId)

  const body = await readBody(event)
  const validation = createGtaInterviewReservationInputSchema.safeParse({
    assignmentId,
    ...body
  })

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid interview reservation parameters',
      data: validation.error.flatten()
    })
  }

  const { startTime, rescheduleReservationId } = validation.data
  const requestedStartTime = new Date(startTime)

  // Enforce minimum lead time (2 hours in advance of now)
  const now = new Date()
  const earliestAllowedBookingTime = new Date(now.getTime() + GTA_INTERVIEW_MIN_LEAD_MS)

  if (requestedStartTime < earliestAllowedBookingTime) {
    throw createError({
      statusCode: 400,
      statusMessage: `Interview reservations must be booked at least ${GTA_INTERVIEW_MIN_LEAD_HOURS} hours in advance.`
    })
  }

  // Fetch assignment & verify configuration
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        select: {
          id: true,
          interviewLocation: true
        }
      }
    }
  })

  if (!assignment || assignment.courseId !== courseId) {
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found in this course' })
  }

  if (!assignment.hasInterviews) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This assignment does not require grading interviews'
    })
  }

  // Check assignment interview window boundaries
  if (assignment.interviewWindowStart && requestedStartTime < assignment.interviewWindowStart) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Requested time is before the assignment interview window opens'
    })
  }
  if (assignment.interviewWindowEnd && requestedStartTime > assignment.interviewWindowEnd) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Requested time is after the assignment interview window closes'
    })
  }

  // Reschedule validation if provided
  let reservationToReschedule: any = null
  if (rescheduleReservationId) {
    const existing = await prisma.gtaInterviewReservation.findUnique({
      where: { id: rescheduleReservationId }
    })
    if (!existing || existing.studentId !== auth.userId || existing.assignmentId !== assignmentId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Reservation to reschedule not found'
      })
    }
    if (
      existing.status !== 'SCHEDULED' &&
      existing.status !== 'MISSED' &&
      existing.status !== 'CANCELLED'
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot reschedule interview reservation in ${existing.status} status`
      })
    }
    reservationToReschedule = existing
  }

  // Ensure student has at most ONE active scheduled interview for this assignment (excluding the one being rescheduled)
  const existingActive = await prisma.gtaInterviewReservation.findFirst({
    where: {
      assignmentId,
      studentId: auth.userId,
      status: 'SCHEDULED',
      ...(rescheduleReservationId ? { id: { not: rescheduleReservationId } } : {})
    }
  })

  if (existingActive) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'You already have an active scheduled interview for this assignment. Please cancel or complete your existing appointment before booking another.'
    })
  }

  // Determine on-duty GTAs for this slot in course local timezone
  const dateStr = getLocalDateString(requestedStartTime, DEFAULT_GTA_TIMEZONE)
  const dateMidnightUtc = new Date(`${dateStr}T00:00:00.000Z`)
  const { hour24, minute } = getLocalTimeParts(requestedStartTime, DEFAULT_GTA_TIMEZONE)
  const slotMinuteOfDay = hour24 * 60 + minute

  const shiftsOnDate = await prisma.gtaShift.findMany({
    where: {
      courseId,
      date: dateMidnightUtc
    }
  })

  // Filter shifts that encompass this slot:
  // shiftStart <= slotMinuteOfDay and slotMinuteOfDay + INTERVIEW_DURATION_MINUTES <= shiftEnd
  const onDutyGtas = shiftsOnDate.filter((s) => {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const shiftStartMin = sh * 60 + sm
    const shiftEndMin = eh * 60 + em
    return (
      shiftStartMin <= slotMinuteOfDay &&
      slotMinuteOfDay + INTERVIEW_DURATION_MINUTES <= shiftEndMin
    )
  })

  if (onDutyGtas.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No Teaching Assistant is on duty for the requested timeslot'
    })
  }

  // Find which of these GTAs already have an active reservation at this exact slot (excluding the reservation being rescheduled)
  const bookedReservations = await prisma.gtaInterviewReservation.findMany({
    where: {
      assignment: { courseId },
      startTime: requestedStartTime,
      status: { notIn: ['CANCELLED', 'MISSED'] },
      ...(rescheduleReservationId ? { id: { not: rescheduleReservationId } } : {})
    },
    select: {
      gtaId: true
    }
  })

  const bookedGtaIdSet = new Set(bookedReservations.map((r) => r.gtaId))
  const availableGtaList = onDutyGtas.filter((s) => !bookedGtaIdSet.has(s.userId))

  if (availableGtaList.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This timeslot has just filled up. Please choose another available slot.'
    })
  }

  // Assign the first available GTA
  const assignedGtaId = availableGtaList[0].userId
  const requestedEndTime = new Date(
    requestedStartTime.getTime() + INTERVIEW_DURATION_MINUTES * 60 * 1000
  )

  const reservation = await prisma.$transaction(async (tx) => {
    if (reservationToReschedule && reservationToReschedule.status === 'SCHEDULED') {
      await tx.gtaInterviewReservation.update({
        where: { id: reservationToReschedule.id },
        data: {
          status: 'CANCELLED'
        }
      })
    }

    return await tx.gtaInterviewReservation.create({
      data: {
        assignmentId,
        studentId: auth.userId,
        gtaId: assignedGtaId,
        startTime: requestedStartTime,
        endTime: requestedEndTime,
        status: 'SCHEDULED'
      },
      include: {
        gta: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        },
        assignment: {
          select: {
            id: true,
            title: true,
            course: {
              select: {
                id: true,
                title: true,
                interviewLocation: true
              }
            }
          }
        }
      }
    })
  })

  return {
    statusCode: 201,
    data: reservation
  }
})
